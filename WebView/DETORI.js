/* ============================================================================
   DETORI - Detalle Ordenes de Inversion
   ============================================================================
   Muestra los movimientos ejecutados (NrSaldo = 50) de una fecha, con filtros
   opcionales de vehiculo, book y especie. Arranca en el primer dia del mes
   del sistema. Se refresca cuando operaciones notifican cambios por SignalR.
   ============================================================================ */
(function () {
    'use strict';

    // ------------------------------------------------------------------ Config
    var HUB_URL         = (window.API_BASE_URL || '') + '/hubs/ppl';
    var NOTIFY_GROUPS   = ['OPERACIONES'];
    var REFRESH_DEBOUNCE_MS = 1200;
    var RECONNECT_MS    = 10000;

    // ------------------------------------------------------------------ Estado
    var dataTable       = null;
    var hubConnection   = null;
    var refreshTimer    = null;
    var fechaSistema    = '';
    var cerrando        = false;

    // ------------------------------------------------------- Puente con PPL
    function pplArg(valor) {
        if (valor === null || valor === undefined) valor = '';
        return "'" + String(valor).trim().replace(/'/g, "''") + "'";
    }

    function pplCall(funcion, args) {
        return bound.execPPL(funcion + '(' + (args || []).map(pplArg).join(', ') + ')');
    }

    function aFilas(result) {
        if (!Array.isArray(result)) return [];
        return result.map(function (fila) {
            var obj = {};
            if (Array.isArray(fila)) {
                fila.forEach(function (par) {
                    if (!par) return;
                    var k = par.key   !== undefined ? par.key   : par.Key;
                    var v = par.value !== undefined ? par.value : par.Value;
                    if (k !== undefined && k !== null) obj[String(k).toLowerCase()] = limpiar(v);
                });
            } else if (fila && typeof fila === 'object') {
                Object.keys(fila).forEach(function (k) { obj[k.toLowerCase()] = limpiar(fila[k]); });
            }
            return obj;
        });
    }

    function limpiar(v) {
        if (v && typeof v === 'object' && !Array.isArray(v) && 'val' in v) v = v.val;
        if (v === undefined) return null;
        return typeof v === 'string' ? v.trim() : v;
    }

    // ------------------------------------------------------------- Formato
    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // 'yyyy-mm-dd' -> 'dd/mm/yyyy'  (para columna Fecha de la grilla)
    function fmtFecha(iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
        return m ? m[3] + '/' + m[2] + '/' + m[1] : (iso || '');
    }

    // 'yyyy-mm-dd' -> 'yyyy-mm-01'  (primer dia del mes)
    function primerDiaMes(iso) {
        var m = /^(\d{4}-\d{2})/.exec(iso || '');
        return m ? m[1] + '-01' : iso;
    }

    function textoSeguro(d, tipo) { return tipo === 'display' ? escapeHtml(d) : d; }

    function numero(decimales) {
        return function (d, tipo) {
            return tipo === 'display' ? $$.numberFormat(d, decimales, false, false) : d;
        };
    }

    function mostrarAviso(texto, tipo) {
        var $a = $('<div class="alert alert-dismissible fade show py-2" role="alert"></div>')
            .addClass('alert-' + (tipo || 'info'))
            .text(texto)
            .append('<button type="button" class="close" data-dismiss="alert"><span>&times;</span></button>');
        $('#detori-aviso').empty().append($a);
    }

    // ------------------------------------------------------- Lookups
    var lookupDt = { vehiculo: null, especie: null, book: null };

    var LOOKUP_CFG = {
        vehiculo: {
            def: 'GetVehiculos',
            getArgs: function () { return []; },
            cols: [
                { data: 'codigo',      title: 'Código',      render: textoSeguro },
                { data: 'descripcion', title: 'Descripción', render: textoSeguro }
            ]
        },
        especie: {
            def: 'GetEspecies',
            getArgs: function () { return []; },
            cols: [
                { data: 'codigo', title: 'Código', render: textoSeguro },
                { data: 'nombre', title: 'Nombre', render: textoSeguro }
            ]
        },
        book: {
            def: 'GetBooks',
            getArgs: function () {
                return [($('#detori-vehiculo').val() || '').trim().toUpperCase()];
            },
            cols: [
                { data: 'codigo',      title: 'Código',      render: textoSeguro },
                { data: 'descripcion', title: 'Descripción', render: textoSeguro }
            ]
        }
    };

    function abrirLookup(tipo) {
        var $modal = $('#detori-modal-' + tipo);
        $modal.modal('show');
        $modal.one('shown.bs.modal', function () {
            var cfg = LOOKUP_CFG[tipo];
            var dtId = '#detori-tbl-' + tipo;

            if (lookupDt[tipo]) {
                // Books se recargan siempre por si cambio el vehiculo
                if (tipo === 'book') {
                    pplCall(cfg.def, cfg.getArgs()).then(function (r) {
                        lookupDt[tipo].clear().rows.add(aFilas(r)).draw();
                    }).catch(function (err) { console.error('GetBooks', err); });
                }
                return;
            }

            pplCall(cfg.def, cfg.getArgs())
                .then(function (r) {
                    lookupDt[tipo] = $(dtId).DataTable({
                        data: aFilas(r),
                        columns: cfg.cols,
                        columnDefs: [{ targets: '_all', defaultContent: '' }],
                        pageLength: 10,
                        autoWidth: false,
                        language: IDIOMA,
                        dom: 'ftp'
                    });
                    $(dtId + ' tbody').on('click', 'tr', function () {
                        var data = lookupDt[tipo].row(this).data();
                        if (!data) return;
                        $('#detori-' + tipo).val((data.codigo || '').trim());
                        if (tipo === 'vehiculo') { lookupDt.book = null; }
                        $modal.modal('hide');
                    });
                })
                .catch(function (err) { console.error('lookup ' + tipo, err); });
        });
    }

    // -------------------------------------------------------------- Grilla
    var IDIOMA = {
        emptyTable:   'No hay registros para mostrar',
        zeroRecords:  'Ningún registro coincide con la búsqueda',
        info:         'Mostrando _START_ a _END_ de _TOTAL_',
        infoEmpty:    'Sin resultados',
        infoFiltered: '(filtrado de _MAX_)',
        search:       'Buscar:',
        lengthMenu:   'Mostrar _MENU_',
        loadingRecords: 'Cargando…',
        paginate: { first: 'Primera', last: 'Última', next: 'Siguiente', previous: 'Anterior' }
    };

    var COLUMNAS = [
        { data: 'nroperacion', title: 'Operación' },
        { data: 'fechamov',    title: 'Fecha',    render: function (d, t) { return t === 'display' ? fmtFecha(d) : d; } },
        { data: 'especie',     title: 'Especie',  render: textoSeguro },
        { data: 'leyenda',     title: 'Leyenda',  render: textoSeguro },
        { data: 'cantidad',    title: 'Cantidad', className: 'text-right', render: numero(2) }
    ];

    function initGrilla() {
        dataTable = $('#detori-dt').DataTable({
            data: [],
            columns: COLUMNAS,
            columnDefs: [{ targets: '_all', defaultContent: '' }],
            order: [[0, 'asc']],
            pageLength: 25,
            autoWidth: false,
            language: IDIOMA,
            dom: 'tip'
        });
    }

    // --------------------------------------------------------------- Datos
    function cargarMovimientos() {
        var fecha    = $('#detori-fecha').val();
        var vehiculo = ($('#detori-vehiculo').val() || '').trim().toUpperCase();
        var book     = ($('#detori-book').val() || '').trim().toUpperCase();
        var especie  = ($('#detori-especie').val() || '').trim().toUpperCase();

        if (!fecha) {
            mostrarAviso('Elegí una fecha.', 'warning');
            return Promise.resolve();
        }
        $('#detori-aviso').empty();
        $$.loading(true);

        pplCall('GetMovSQL', [fecha, vehiculo, book, especie])
            .then(function (sql) { console.info('[DETORI] SQL:', sql); })
            .catch(function () {});

        return pplCall('GetMovEjecutados', [fecha, vehiculo, book, especie])
            .then(function (result) {
                console.info('[DETORI] GetMovEjecutados raw:', JSON.stringify(result).substring(0, 500));
                var filas = aFilas(result);
                console.info('[DETORI] filas procesadas:', filas.length, filas[0] || '(vacío)');
                dataTable.clear().rows.add(filas).draw();
                $('#detori-total-filas').text(filas.length);

                var saldo = filas.reduce(function (acc, f) {
                    return acc + (parseFloat(f.cantidad) || 0);
                }, 0);
                if (filas.length > 0) {
                    $('#detori-saldo-valor').text($$.numberFormat(saldo, 2, false, false));
                    $('#detori-saldo').removeClass('d-none');
                } else {
                    $('#detori-saldo').addClass('d-none');
                }
            })
            .catch(function (err) {
                console.error('GetMovEjecutados', err);
                mostrarAviso('No se pudieron cargar los movimientos.', 'danger');
            })
            .then(function () { $$.loading(false); });
    }

    // ---------------------------------------------------------- Tiempo real
    function programarRefresco() {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(cargarMovimientos, REFRESH_DEBOUNCE_MS);
    }

    function ponerEstado(estado) {
        var cfg = {
            conectado:    ['text-success', 'En vivo'],
            reconectando: ['text-warning', 'Reconectando…'],
            desconectado: ['text-danger',  'Sin tiempo real']
        }[estado] || ['text-muted', 'Conectando…'];
        $('#ws-status').attr('class', cfg[0]).html('<i class="fas fa-circle"></i> ' + cfg[1]);
    }

    function suscribir() {
        console.warn('[DETORI] suscribir() llamado');
        hubConnection.invoke('SubscribeMany', NOTIFY_GROUPS)
            .then(function () { console.warn('[DETORI] SubscribeMany OK:', NOTIFY_GROUPS); })
            .catch(function (err) { console.warn('[DETORI] SubscribeMany ERROR:', err); });
    }

    function iniciarConexion() {
        if (cerrando || !hubConnection) return;
        console.warn('[DETORI] iniciarConexion() llamado');
        hubConnection.start()
            .then(function () { console.warn('[DETORI] start() OK'); ponerEstado('conectado'); suscribir(); })
            .catch(function (err) {
                console.warn('[DETORI] start() ERROR:', err);
                ponerEstado('desconectado');
                setTimeout(iniciarConexion, RECONNECT_MS);
            });
    }

    function conectarTiempoReal() {
        console.warn('[DETORI] conectarTiempoReal() llamado, signalR:', typeof signalR);
        if (typeof signalR === 'undefined') { ponerEstado('desconectado'); return; }
        hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(HUB_URL, { withCredentials: true })
            .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        hubConnection.on('ReceiveMessage', function (messageCode) {
            console.info('[DETORI] ReceiveMessage:', messageCode);
            if (NOTIFY_GROUPS.indexOf(String(messageCode || '')) !== -1) programarRefresco();
        });
        hubConnection.on('Notify',  function () { console.info('[DETORI] Notify:',  Array.prototype.slice.call(arguments)); });
        hubConnection.on('Update',  function () { console.info('[DETORI] Update:',  Array.prototype.slice.call(arguments)); });
        hubConnection.on('Refresh', function () { console.info('[DETORI] Refresh:', Array.prototype.slice.call(arguments)); });
        hubConnection.onreconnecting(function ()  { ponerEstado('reconectando'); });
        hubConnection.onreconnected(function ()   { ponerEstado('conectado'); suscribir(); programarRefresco(); });
        hubConnection.onclose(function () {
            if (cerrando) return;
            ponerEstado('desconectado');
            setTimeout(iniciarConexion, RECONNECT_MS);
        });

        iniciarConexion();
    }

    // -------------------------------------------------------------- Eventos
    function enlazarEventos() {
        $('#detori-filtros').on('submit', function (e) {
            e.preventDefault();
            cargarMovimientos();
        });

        $(document).on('click', '.detori-lkp-btn', function (e) {
            e.preventDefault();
            abrirLookup($(this).data('lookup'));
        });

        $(document).on('click', 'a[href="#"], a[href=""], a:not([href])', function (e) { e.preventDefault(); });
    }

    window.addEventListener('pagehide', function () {
        cerrando = true;
        if (hubConnection) hubConnection.stop();
    });

    // ----------------------------------------------------------------- Init
    $(function () {
        initGrilla();
        enlazarEventos();

        pplCall('GetDbInfo', []).then(function (r) {
            var filas = aFilas(r);
            if (filas.length) console.info('[DETORI] Conexion:', filas[0].servidor, '/', filas[0].basedatos);
        }).catch(function () {});

        pplCall('GetFechaSistema', [])
            .then(function (r) {
                fechaSistema = String(r || '').substring(0, 10);
                if (fechaSistema) $('#detori-fecha').val(primerDiaMes(fechaSistema));

                var fechaDiag = primerDiaMes(fechaSistema) || fechaSistema;
                pplCall('GetMovDiag', [fechaDiag]).then(function (rd) {
                    var d = aFilas(rd);
                    if (d.length) console.info('[DETORI] Diag:', JSON.stringify(d[0]));
                }).catch(function (e) { console.warn('[DETORI] Diag error:', e); });

                return cargarMovimientos();
            })
            .catch(function (err) { console.error('Init', err); });

        conectarTiempoReal();
    });
})();
