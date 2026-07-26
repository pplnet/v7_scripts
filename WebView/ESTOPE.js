/* ============================================================================
   JavaScript: Estado de Operaciones en Tiempo Real (ESTOPE)
   ============================================================================
   Replica el informe ESTOPE en una grilla interactiva. Carga las operaciones y
   sus estados desde el backend PPL (bound.execPPL), permite filtrar/ordenar/ver
   detalle, y se refresca en tiempo real via SignalR cuando llegan eventos de
   proceso o notificaciones relacionadas con operaciones.

   Endpoint del Hub: https://localhost:44300/hubs/ppl
   ============================================================================ */

(function () {
    'use strict';

    // ----------------------------------------------------------------------
    // Config
    // ----------------------------------------------------------------------
    const API_BASE_URL = window.API_BASE_URL || 'https://localhost:44300';
    const HUB_URL = API_BASE_URL + '/hubs/ppl';
    const FIREHOSE_GROUP = '__NOTIF_ALL__';
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
        { className: 'details-control', orderable: false, data: null, defaultContent: '' },
        {
            data: 'Instancia', title: 'Estado',
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
            order: [[2, 'desc']],
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

        // Expandir/colapsar detalle
        $('#dt1 tbody').on('click', 'td.details-control', function () {
            const tr = $(this).closest('tr');
            const row = dataTable.row(tr);
            if (row.child.isShown()) {
                row.child.hide();
                tr.removeClass('shown');
            } else {
                loadDetalle(row.data().NrOperacion, row, tr);
            }
        });

        // Doble click -> modal
        $('#dt1 tbody').on('dblclick', 'tr', function () {
            const row = dataTable.row(this);
            if (row.data()) openModal(row.data().NrOperacion);
        });
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
            $$.loading(false);
        }).catch(function (err) {
            $$.loading(false);
            console.error('Error cargando operaciones:', err);
            showToast('Error al cargar las operaciones', 'danger');
        });
    }

    function loadEstadisticas() {
        bound.execPPL('GetEstadisticas()').then(function (result) {
            let s = result;
            if (Array.isArray(result) && result.length > 0) {
                s = Array.isArray(result[0]) ? transformRow(result[0])
                    : (result[0].key !== undefined ? transformRow(result) : result[0]);
            }
            if (!s) return;
            $('#stat-total').text(s.TotalOperaciones || 0);
            $('#stat-hoy').text(s.OperacionesHoy || 0);
            $('#stat-especies').text(s.EspeciesDistintas || 0);
            $('#stat-tipos').text(s.TiposDistintos || 0);
        }).catch(function (err) { console.error('Error cargando estadisticas:', err); });
    }

    function buildFilters() {
        // Tipos de operacion
        bound.execPPL('GetTiposOp()').then(function (result) {
            const tipos = transformData(result);
            const el = $('#filter-tipo').empty();
            appendFilterItem(el, '', 'Todos', 7, '#dropdownTipo', 'Todos los tipos');
            tipos.forEach(function (t) {
                appendFilterItem(el, t.TipoOp, t.TipoOp, 7, '#dropdownTipo', 'Todos los tipos');
            });
        });
        // Instancias (estados)
        bound.execPPL('GetInstancias()').then(function (result) {
            const insts = transformData(result);
            const el = $('#filter-instancia').empty();
            appendFilterItem(el, '', 'Todos', 1, '#dropdownInstancia', 'Todos los estados');
            insts.forEach(function (i) {
                appendFilterItem(el, i.Instancia, i.Instancia, 1, '#dropdownInstancia', 'Todos los estados');
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
    function loadDetalle(nr, row, tr) {
        $$.loading(true);
        bound.execPPL("GetDetalleOperacion('" + nr + "')").then(function (result) {
            $$.loading(false);
            const det = transformData(result);
            row.child(renderDetalle(det[0])).show();
            tr.addClass('shown');
        }).catch(function (err) {
            $$.loading(false);
            console.error('Error cargando detalle:', err);
        });
    }

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

    function renderDetalle(d) {
        return '<table class="table table-sm table-bordered mb-0">' + detalleRows(d) + '</table>';
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
            loadOperaciones(false).then(loadEstadisticas);
        }, REFRESH_DEBOUNCE_MS);
    }

    // Decide si un evento SignalR amerita refrescar la grilla de operaciones.
    function isOperationEvent(messageCode, payload) {
        const code = String(messageCode || '');
        if (code.indexOf('PROCESS_') === 0) return true;   // alta/edicion/avance de op via proceso
        const g = code.toLowerCase();
        if (/(oper|orden|trans|minut|opmin)/.test(g)) return true;
        // Sobre / batch con grupo relacionado a operaciones
        if (payload && typeof payload === 'object') {
            const grp = String(payload.grupo || '').toLowerCase();
            if (/(oper|orden|trans|minut|opmin)/.test(grp)) return true;
        }
        return false;
    }

    // ======================================================================
    // SignalR
    // ======================================================================
    function setupWebSocket() {
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

        hubConnection.on('ReceiveMessage', function (messageCode, payload) {
            if (isOperationEvent(messageCode, payload)) scheduleRefresh();
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

    function subscribeAll() {
        // El grupo user:{codigo} se auto-une en OnConnectedAsync (eventos PROCESS_*).
        // Nos suscribimos ademas al firehose para captar notificaciones PPL de operaciones.
        hubConnection.invoke('Subscribe', FIREHOSE_GROUP)
            .catch(function (err) { console.error('Error suscribiendo al firehose:', err); });
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
        loadEstadisticas();
        buildFilters();
        setupEventListeners();
        setupWebSocket();
    }

    function setupEventListeners() {
        $('#btn-refresh').on('click', function () {
            loadOperaciones(true).then(function () {
                loadEstadisticas();
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
    }

    window.addEventListener('beforeunload', function () {
        if (hubConnection) hubConnection.stop();
    });

    $(document).ready(function () {
        $(document).on('click', 'a[href="#"], a[href=""]', function (e) { e.preventDefault(); });
        init();
    });

})();
