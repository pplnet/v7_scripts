/* ============================================================================
   JavaScript: Estado de Operaciones en Tiempo Real (ESTOPE)
   ============================================================================
   Replica el informe ESTOPE en una grilla interactiva. Carga las operaciones y
   sus estados desde el backend PPL (bound.execPPL), permite filtrar/ordenar/ver
   detalle, y se refresca en tiempo real via SignalR cuando llega una notificacion
   de alguno de los grupos de NOTIFICACION del ciclo de vida de una operacion
   (ALTA, EDICION, BAJA, AVANZA, RETROCEDE).

   Endpoint del Hub: https://localhost:44300/hubs/ppl
   ============================================================================ */

(function () {
    'use strict';

    // ----------------------------------------------------------------------
    // Config
    // ----------------------------------------------------------------------
    const API_BASE_URL = window.API_BASE_URL || 'https://localhost:44300';
    const HUB_URL = API_BASE_URL + '/hubs/ppl';
    // Grupos de la seccion NOTIFICACION que ameritan refrescar la grilla. Se
    // matchean EXACTO y son case-sensitive tanto en la suscripcion como en el
    // filtro: asi son los grupos de SignalR y asi los escribe el catalogo PPL.
    const NOTIFY_GROUPS = ['ALTA', 'EDICION', 'BAJA', 'AVANZA', 'RETROCEDE'];
    const RECONNECT_DELAY_MS = 3000;
    const MAX_RECONNECT_ATTEMPTS = 15;
    const REFRESH_DEBOUNCE_MS = 1200;    // agrupa rafagas de eventos en un solo refresh

    // ----------------------------------------------------------------------
    // Estado
    // ----------------------------------------------------------------------
    let dataTable = null;
    let operacionesData = [];
    let hubConnection = null;
    let reconnectAttempts = 0;
    let refreshTimer = null;
    let fechaSistema = '';   // FSYS (ISO yyyy-MM-dd) — default de los filtros de fecha

    // ======================================================================
    // Transformacion de datos del backend
    // ======================================================================
    function capKey(key) {
        if (!key) return key;
        const map = {
            'instancia': 'Instancia', 'nroperacion': 'NrOperacion', 'fechaop': 'FechaOp',
            'fechavto': 'FechaVto', 'especie': 'Especie', 'contraespecie': 'ContraEspecie',
            'tipoop': 'TipoOp', 'mercado': 'Mercado', 'cliente': 'Cliente',
            'cantidad': 'Cantidad', 'precio': 'Precio', 'vehiculo': 'Vehiculo',
            'operador': 'Operador', 'importe': 'Importe', 'observaciones': 'Observaciones',
            'totaloperaciones': 'TotalOperaciones', 'operacioneshoy': 'OperacionesHoy',
            'especiesdistintas': 'EspeciesDistintas', 'tiposdistintos': 'TiposDistintos'
        };
        const lk = key.toLowerCase();
        return map[lk] || (key.charAt(0).toUpperCase() + key.slice(1));
    }

    function transformRow(row) {
        if (!Array.isArray(row)) return row;
        const obj = {};
        row.forEach(function (item) {
            if (item && item.key !== undefined) {
                obj[capKey(item.key)] = typeof item.value === 'string' ? item.value.trim() : item.value;
            }
        });
        return obj;
    }

    function transformData(data) {
        if (!data) return [];
        if (data.result && Array.isArray(data.result)) data = data.result;
        if (!Array.isArray(data)) return [];
        if (data.length > 0 && Array.isArray(data[0])) return data.map(transformRow);
        return data.map(function (row) {
            if (row && typeof row === 'object' && !Array.isArray(row)) {
                const obj = {};
                Object.keys(row).forEach(function (k) {
                    obj[capKey(k)] = typeof row[k] === 'string' ? row[k].trim() : row[k];
                });
                return obj;
            }
            return row;
        });
    }

    // Las columnas NULL las omite el backend del objeto de la fila. Aseguramos que
    // cada fila tenga TODAS las columnas que la grilla espera (evita el warning
    // "Requested unknown parameter" de DataTables).
    const OP_FIELDS = ['Instancia', 'NrOperacion', 'FechaOp', 'FechaVto', 'Especie',
        'ContraEspecie', 'TipoOp', 'Mercado', 'Cliente', 'Cantidad', 'Precio',
        'Vehiculo', 'Operador'];

    function normalizeOps(rows) {
        return rows.map(function (r) {
            const o = r || {};
            OP_FIELDS.forEach(function (f) {
                if (o[f] === undefined || o[f] === null) {
                    o[f] = (f === 'Cantidad' || f === 'Precio') ? 0 : '';
                }
            });
            return o;
        });
    }

    // ======================================================================
    // DataTable
    // ======================================================================
    const colsConfig = [
        {
            data: 'Instancia', title: 'Instancia',
            render: function (d, type) {
                if (type !== 'display') return d;
                return '<span class="badge-estado">' + escapeHtml(d || '-') + '</span>';
            }
        },
        { data: 'NrOperacion', title: 'Numero' },
        { data: 'FechaOp', title: 'F. Op.' },
        { data: 'FechaVto', title: 'F. Vto.' },
        { data: 'Especie', title: 'Especie' },
        { data: 'ContraEspecie', title: 'Moneda' },
        { data: 'TipoOp', title: 'Tipo' },
        { data: 'Mercado', title: 'Mercado' },
        { data: 'Cliente', title: 'Cliente' },
        {
            data: 'Cantidad', title: 'Cantidad', className: 'text-right',
            render: function (d, type) { return type === 'display' ? $$.numberFormat(d, 2, false, false) : d; }
        },
        {
            data: 'Precio', title: 'Precio', className: 'text-right',
            render: function (d, type) { return type === 'display' ? $$.numberFormat(d, 4, false, false) : d; }
        },
        { data: 'Vehiculo', title: 'Vehiculo' },
        { data: 'Operador', title: 'Operador' }
    ];

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function initDataTable() {
        dataTable = $('#dt1').DataTable({
            scrollX: true,
            searching: true,
            pageLength: 25,
            data: operacionesData,
            columns: colsConfig,
            order: [[1, 'desc']],
            language: {
                zeroRecords: 'No se encontraron operaciones',
                info: 'Mostrando _START_ a _END_ de _TOTAL_',
                infoEmpty: '',
                infoFiltered: '(filtrado de _MAX_)',
                search: 'Buscar:',
                lengthMenu: 'Mostrar _MENU_',
                paginate: { first: 'Primera', last: 'Ultima', next: 'Sig >', previous: '< Ant' }
            },
            rowCallback: function (row, data) {
                $(row).attr('data-nr', data.NrOperacion);
            }
        });

        $$.setDataTable(dataTable, '#dt1');
        $$.setKeyNames(['NrOperacion']);

        // Las tarjetas de resumen se recalculan en CADA draw: es el unico evento
        // por el que pasan los tres caminos que cambian lo listado — la recarga
        // por fecha (server-side, via $$.setData), los filtros de Tipo/Instancia
        // (client-side, column().search().draw()) y el buscador. Engancharlos uno
        // por uno dejaria afuera al proximo que se agregue.
        $('#dt1').on('draw.dt', updateStats);

        // Doble click -> modal de detalle
        $('#dt1 tbody').on('dblclick', 'tr', function () {
            const row = dataTable.row(this);
            if (row.data()) openModal(row.data().NrOperacion);
        });
    }

    // Re-sincroniza el header con el cuerpo cuando scrollX esta activo. Sin
    // esto, un nombre de instancia largo ensancha la columna del cuerpo pero el
    // header (tabla separada de DataTables) queda con el ancho viejo -> se
    // desfasa. Hay que llamarlo tras cada carga de datos y en cada resize.
    function adjustColumns() {
        if (dataTable) dataTable.columns.adjust();
    }

    // ======================================================================
    // Filtro por fecha (server-side)
    // ======================================================================
    // Solo aceptamos el ISO yyyy-MM-dd del <input type="date">; cualquier otra
    // cosa se descarta (el backend igual re-sanitiza con IdxDate).
    function sanitizeIsoDate(v) {
        return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '';
    }

    // Rango vigente de los inputs. Un extremo vacio deja ese lado abierto.
    function getFechaRange() {
        return {
            desde: sanitizeIsoDate(($('#filter-fecha-desde').val() || '').trim()),
            hasta: sanitizeIsoDate(($('#filter-fecha-hasta').val() || '').trim())
        };
    }

    // Fecha del sistema (FSYS) para el default de los filtros. Tabla 1x1.
    function fetchFechaSistema() {
        return bound.execPPL('GetFechaSistema()').then(function (result) {
            const rows = transformData(result);
            return rows[0] && rows[0].Fecha ? rows[0].Fecha : '';
        }).catch(function (err) {
            console.error('Error obteniendo la fecha del sistema:', err);
            return '';
        });
    }

    // ======================================================================
    // Carga de datos
    // ======================================================================
    function loadOperaciones(showLoading) {
        if (showLoading) $$.loading(true);
        const r = getFechaRange();
        const expr = "GetOperaciones('" + r.desde + "','" + r.hasta + "')";
        return bound.execPPL(expr).then(function (result) {
            operacionesData = normalizeOps(transformData(result));
            $$.setData(operacionesData, colsConfig);
            adjustColumns();   // re-sincroniza header/cuerpo (scrollX) tras el draw
            $$.loading(false);
        }).catch(function (err) {
            $$.loading(false);
            console.error('Error cargando operaciones:', err);
            showToast('Error al cargar las operaciones', 'danger');
        });
    }

    // ======================================================================
    // Tarjetas de resumen
    // ======================================================================
    // Se calculan en el CLIENTE sobre las filas que la grilla tiene filtradas
    // (mismo criterio que los graficos de POSI4, que se re-renderizan con cada
    // carga): asi las tarjetas describen SIEMPRE lo que se esta viendo.
    //
    // ⚠️ Antes salian de `GetEstadisticas()`, que NO recibe ningun filtro y
    // cuenta la tabla OPERACIONES entera: cambiar cualquier filtro movia la
    // grilla y dejaba las tarjetas clavadas. Y no alcanzaba con volver a
    // llamarla en cada cambio — los filtros de Tipo e Instancia son
    // client-side (DataTables), asi que el backend ni se entera de ellos.
    //
    // ⚠️ El universo son las filas CARGADAS: `GetOperaciones` corta en TOP 500,
    // asi que estos numeros resumen lo listado, no toda la base. Es el precio
    // de que la tarjeta y la grilla no puedan contradecirse.
    function filteredRows() {
        if (!dataTable) return [];
        return dataTable.rows({ search: 'applied' }).data().toArray();
    }

    // dd/MM/yyyy (CONVERT 103 del .ppl) -> yyyyMMdd, comparable como string.
    // Cualquier otra cosa -> '' (no participa del maximo).
    function fechaKey(v) {
        const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v || '').trim());
        return m ? m[3] + m[2] + m[1] : '';
    }

    function updateStats() {
        const rows = filteredRows();
        const especies = {}, tipos = {};
        let maxFecha = '';

        rows.forEach(function (r) {
            if (r.Especie) especies[r.Especie] = true;
            if (r.TipoOp) tipos[r.TipoOp] = true;
            const k = fechaKey(r.FechaOp);
            if (k > maxFecha) maxFecha = k;
        });

        const delUltimoDia = maxFecha
            ? rows.filter(function (r) { return fechaKey(r.FechaOp) === maxFecha; }).length
            : 0;

        $('#stat-total').text(rows.length);
        $('#stat-hoy').text(delUltimoDia);
        $('#stat-especies').text(Object.keys(especies).length);
        $('#stat-tipos').text(Object.keys(tipos).length);
    }

    function buildFilters() {
        // Tipos de operacion
        bound.execPPL('GetTiposOp()').then(function (result) {
            const tipos = transformData(result);
            const el = $('#filter-tipo').empty();
            appendFilterItem(el, '', 'Todos', 6, '#dropdownTipo', 'Todos los tipos');
            tipos.forEach(function (t) {
                appendFilterItem(el, t.TipoOp, t.TipoOp, 6, '#dropdownTipo', 'Todos los tipos');
            });
        });
        // Instancias (estados)
        bound.execPPL('GetInstancias()').then(function (result) {
            const insts = transformData(result);
            const el = $('#filter-instancia').empty();
            appendFilterItem(el, '', 'Todos', 0, '#dropdownInstancia', 'Todos los estados');
            insts.forEach(function (i) {
                appendFilterItem(el, i.Instancia, i.Instancia, 0, '#dropdownInstancia', 'Todos los estados');
            });
        });
    }

    function appendFilterItem(container, value, label, colIdx, btnSel, allLabel) {
        const item = $('<a class="dropdown-item" href="javascript:void(0)"></a>')
            .attr('data-value', value).text(label);
        item.on('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            // Busqueda exacta por columna (regex, anclada) para no confundir substrings.
            const v = $(this).data('value');
            dataTable.column(colIdx).search(v ? '^' + escapeRegex(v) + '$' : '', true, false).draw();
            $(btnSel).text(v || allLabel);
        });
        container.append(item);
    }

    function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    // ======================================================================
    // Detalle
    // ======================================================================
    // Filas <tr> clave/valor del detalle de una operacion.
    function detalleRows(d) {
        if (!d) return '<tr><td class="text-center">Sin detalle disponible</td></tr>';
        return rowKV('Especie', d.Especie) +
            rowKV('Moneda', d.ContraEspecie) +
            rowKV('Cantidad', $$.numberFormat(d.Cantidad || 0, 2, false, false)) +
            rowKV('Precio', $$.numberFormat(d.Precio || 0, 4, false, false)) +
            rowKV('Importe', $$.numberFormat(d.Importe || 0, 2, false, false)) +
            rowKV('Mercado', d.Mercado) +
            rowKV('Operador', d.Operador) +
            rowKV('Observaciones', d.Observaciones);
    }

    function rowKV(k, v) {
        return '<tr><th>' + escapeHtml(k) + '</th><td>' + escapeHtml(v || '-') + '</td></tr>';
    }

    function openModal(nr) {
        $('#modal-nro').text(nr);
        $('#modalDetalle').modal('show');
        bound.execPPL("GetDetalleOperacion('" + nr + "')").then(function (result) {
            const det = transformData(result);
            $('#dt-detalle tbody').html(detalleRows(det[0]));
        });
    }

    // ======================================================================
    // Refresh en tiempo real
    // ======================================================================
    function scheduleRefresh() {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(function () {
            loadOperaciones(false);
        }, REFRESH_DEBOUNCE_MS);
    }

    // Decide si un evento SignalR amerita refrescar la grilla de operaciones.
    // El messageCode de una notificacion PPL ES el nombre del grupo emisor.
    function isOperationEvent(messageCode) {
        return NOTIFY_GROUPS.indexOf(String(messageCode || '')) !== -1;
    }

    // ======================================================================
    // SignalR
    // ======================================================================
    function setupWebSocket() {
        // Sin la libreria de SignalR no hay tiempo real, pero la grilla y los
        // filtros funcionan igual: sin esta guarda el `new signalR...` tira un
        // ReferenceError, el chip queda en "Conectando..." para siempre y la
        // pantalla aparenta estar sana. Mismo criterio que POSI4 con Chart.js.
        if (typeof signalR === 'undefined') {
            console.error('ESTOPE: signalR no disponible — la grilla no se va a refrescar sola');
            setStatus('error');
            return;
        }

        hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(HUB_URL, { withCredentials: true })
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: function (ctx) {
                    if (ctx.previousRetryCount >= MAX_RECONNECT_ATTEMPTS) return null;
                    return Math.min(RECONNECT_DELAY_MS * Math.pow(1.5, ctx.previousRetryCount), 30000);
                }
            })
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        hubConnection.on('ReceiveMessage', function (messageCode) {
            if (isOperationEvent(messageCode)) scheduleRefresh();
        });

        hubConnection.onreconnecting(function () { setStatus('reconnecting'); });
        hubConnection.onreconnected(function () { setStatus('connected'); subscribeAll(); scheduleRefresh(); });
        hubConnection.onclose(function () {
            setStatus('disconnected');
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts += 1;
                setTimeout(startConnection, RECONNECT_DELAY_MS * reconnectAttempts);
            }
        });

        startConnection();
    }

    function startConnection() {
        hubConnection.start()
            .then(function () {
                reconnectAttempts = 0;
                setStatus('connected');
                subscribeAll();
            })
            .catch(function (err) {
                console.error('Error conectando al Hub:', err);
                setStatus('error');
                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts += 1;
                    setTimeout(startConnection, RECONNECT_DELAY_MS * reconnectAttempts);
                }
            });
    }

    // Se re-invoca en cada (re)conexion: la membresia de grupo de SignalR es por
    // connectionId y se pierde al reconectar.
    function subscribeAll() {
        hubConnection.invoke('SubscribeMany', NOTIFY_GROUPS)
            .catch(function (err) { console.error('Error suscribiendo a los grupos de notificacion:', err); });
    }

    function setStatus(status) {
        let html, cls;
        switch (status) {
            case 'connected':
                html = '<i class="fas fa-circle text-success"></i> En vivo'; cls = 'text-success'; break;
            case 'reconnecting':
                html = '<i class="fas fa-circle text-warning"></i> Reconectando…'; cls = 'text-warning'; break;
            case 'disconnected':
            case 'error':
                html = '<i class="fas fa-circle text-danger"></i> Desconectado'; cls = 'text-danger'; break;
            default:
                html = '<i class="fas fa-circle text-muted"></i> Conectando…'; cls = 'text-muted';
        }
        $('#ws-status').html(html).removeClass().addClass(cls);
    }

    // ======================================================================
    // Toast
    // ======================================================================
    function showToast(msg, type) {
        const cls = { info: 'alert-info', success: 'alert-success', warning: 'alert-warning', danger: 'alert-danger' }[type] || 'alert-info';
        const n = $('<div class="alert ' + cls + ' alert-dismissible fade show position-fixed" role="alert" style="top:20px;right:20px;z-index:9999;">')
            .html(escapeHtml(msg) + '<button type="button" class="close" data-dismiss="alert"><span>&times;</span></button>');
        $('body').append(n);
        setTimeout(function () { n.alert('close'); }, 3000);
    }

    // ======================================================================
    // Init
    // ======================================================================
    function init() {
        initDataTable();
        // Default: rango = fecha del sistema (FSYS) → al abrir solo se ven las
        // operaciones del dia. Seteamos los inputs y recien ahi cargamos.
        fetchFechaSistema().then(function (fsys) {
            fechaSistema = fsys;
            if (fsys) {
                $('#filter-fecha-desde').val(fsys);
                $('#filter-fecha-hasta').val(fsys);
            }
            loadOperaciones(true);
        });
        buildFilters();
        setupEventListeners();
        setupWebSocket();
    }

    function setupEventListeners() {
        $('#btn-refresh').on('click', function () {
            loadOperaciones(true).then(function () {
                showToast('Datos actualizados', 'success');
            });
        });

        // Cambiar cualquiera de las fechas recarga la grilla (filtro server-side).
        $('#filter-fecha-desde, #filter-fecha-hasta').on('change', function () {
            loadOperaciones(true);
        });

        // "Hoy": vuelve ambos filtros a la fecha del sistema y recarga.
        $('#btn-hoy').on('click', function () {
            if (fechaSistema) {
                $('#filter-fecha-desde').val(fechaSistema);
                $('#filter-fecha-hasta').val(fechaSistema);
            }
            loadOperaciones(true);
        });

        // Al redimensionar la ventana, re-alinear header/cuerpo (scrollX).
        $(window).on('resize', adjustColumns);
    }

    window.addEventListener('beforeunload', function () {
        if (hubConnection) hubConnection.stop();
    });

    $(document).ready(function () {
        $(document).on('click', 'a[href="#"], a[href=""]', function (e) { e.preventDefault(); });
        init();
    });

})();
