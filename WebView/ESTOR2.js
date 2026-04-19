/* ============================================================================
   JavaScript: Monitor de Ordenes en Tiempo Real (V2)
   ============================================================================
   Dashboard con filtros dinamicos y actualizacion automatica via WebSocket
   ============================================================================ */

(function() {
    'use strict';

    var dataTable = null;
    var ordenesData = [];
    var hubConnection = null;
    var reconnectAttempts = 0;
    var MAX_RECONNECT_ATTEMPTS = 10;
    var RECONNECT_DELAY_MS = 3000;

    var API_BASE_URL = window.API_BASE_URL || 'https://localhost:44300';
    var NOTIFICATIONS_URL = API_BASE_URL + '/notifications';
    var HUB_URL = API_BASE_URL + '/hubs/ppl';

    // ========================================================================
    // Key mapping
    // ========================================================================
    var keyMap = {
        'tipoorden': 'TipoOrden',
        'nrorden': 'NrOrden',
        'nroorden': 'NrOrden',
        'fechaorden': 'FechaOrden',
        'cliente': 'Cliente',
        'clientenombre': 'ClienteNombre',
        'especie': 'Especie',
        'especienombre': 'EspecieNombre',
        'estado': 'Estado',
        'cantidad': 'Cantidad',
        'precio': 'Precio',
        'monto': 'Monto',
        'contraespecie': 'ContraEspecie',
        'mercado': 'Mercado',
        'cantidadtotalorden': 'CantidadTotalOrden',
        'preciolimite': 'PrecioLimite',
        'importe': 'Importe',
        'aranceles': 'Aranceles',
        'derechobolsa': 'DerechoBolsa',
        'derechomercado': 'DerechoMercado',
        'nroitem': 'NroItem',
        'totalordenes': 'TotalOrdenes',
        'pendientes': 'Pendientes',
        'ejecutadas': 'Ejecutadas',
        'canceladas': 'Canceladas',
        'montototalarp': 'MontoTotalARP',
        'montototalusd': 'MontoTotalUSD'
    };

    function capitalizeKey(key) {
        if (!key) return key;
        var lower = key.toLowerCase();
        return keyMap[lower] || (key.charAt(0).toUpperCase() + key.slice(1));
    }

    function transformRow(row) {
        if (!row || !Array.isArray(row)) return row;
        var obj = {};
        row.forEach(function(item) {
            if (item && item.key !== undefined) {
                obj[capitalizeKey(item.key)] = typeof item.value === 'string' ? item.value.trim() : item.value;
            }
        });
        return obj;
    }

    function transformData(data) {
        if (!data) return [];
        if (data.result && Array.isArray(data.result)) data = data.result;
        if (!Array.isArray(data)) return [];

        if (data.length > 0 && Array.isArray(data[0])) {
            return data.map(transformRow);
        }

        return data.map(function(row) {
            if (row && typeof row === 'object' && !Array.isArray(row)) {
                var obj = {};
                Object.keys(row).forEach(function(k) {
                    obj[capitalizeKey(k)] = typeof row[k] === 'string' ? row[k].trim() : row[k];
                });
                return obj;
            }
            return row;
        });
    }

    // ========================================================================
    // Estado display helper
    // ========================================================================
    function renderEstado(data) {
        var badge = 'estor2-badge-pen';
        var text = data || '?';

        switch ((data || '').toUpperCase()) {
            case 'COM': badge = 'estor2-badge-com'; text = 'Completada'; break;
            case 'EJE': badge = 'estor2-badge-com'; text = 'Ejecutada'; break;
            case 'CAN': badge = 'estor2-badge-can'; text = 'Cancelada'; break;
            case 'PEN': badge = 'estor2-badge-pen'; text = 'Pendiente'; break;
            case 'PAR': badge = 'estor2-badge-par'; text = 'Parcial'; break;
            case 'PRO': badge = 'estor2-badge-pro'; text = 'En Proceso'; break;
            case 'REC': badge = 'estor2-badge-rec'; text = 'Rechazada'; break;
        }

        return '<span class="estor2-badge ' + badge + '">' + text + '</span>';
    }

    // ========================================================================
    // DataTable columns
    // ========================================================================
    var colsConfig = [
        { className: 'details-control', orderable: false, data: null, defaultContent: '' },
        { data: 'TipoOrden', title: 'Tipo' },
        { data: 'NrOrden', title: 'Nro. Orden' },
        { data: 'FechaOrden', title: 'Fecha' },
        {
            data: 'Cliente',
            title: 'Cliente',
            render: function(data, type, row) {
                if (type === 'display') {
                    var nombre = row.ClienteNombre || '';
                    return nombre ? data + ' - ' + nombre : data;
                }
                return data;
            }
        },
        { data: 'Especie', title: 'Especie' },
        {
            data: 'Estado',
            title: 'Estado',
            render: function(data, type) {
                return type === 'display' ? renderEstado(data) : data;
            }
        },
        {
            data: 'Monto',
            title: 'Monto',
            render: function(data, type) {
                return type === 'display' ? $$.numberFormat(data, 2, true, false) : data;
            }
        },
        { data: 'ContraEspecie', title: 'C.Especie' }
    ];

    // ========================================================================
    // Init
    // ========================================================================
    function init() {
        console.log('ESTOR2: Inicializando...');

        loadInitialData();
        initDataTable();
        loadStatistics();
        setupEventListeners();
        setupWebSocketConnection();

        console.log('ESTOR2: Inicializado');
    }

    // ========================================================================
    // Load data
    // ========================================================================
    function loadInitialData() {
        bound.execPPL("GetOrdenes()").then(function(result) {
            ordenesData = transformData(result);
            console.log('ESTOR2: Ordenes cargadas:', ordenesData.length);
            if (dataTable) $$.setData(ordenesData, colsConfig);
        }).catch(function(err) {
            console.error('Error cargando ordenes:', err);
            showToast('Error al cargar las órdenes', 'error');
        });
    }

    function initDataTable() {
        var dtSelector = '#dt1';

        dataTable = $(dtSelector).DataTable({
            scrollX: true,
            searching: true,
            lengthChange: true,
            pageLength: 25,
            data: ordenesData,
            columns: colsConfig,
            language: {
                zeroRecords: "No se encontraron órdenes",
                info: "Página _PAGE_ de _PAGES_",
                infoEmpty: "",
                infoFiltered: "(filtrado de _MAX_ registros)",
                search: "Buscar:",
                lengthMenu: "Mostrar _MENU_",
                paginate: { first: "Primera", last: "Última", next: ">", previous: "<" }
            },
            order: [[2, 'desc']],
            rowCallback: function(row, data) {
                $(row).attr('data-nr-orden', data.NrOrden);
            }
        });

        $$.setDataTable(dataTable, dtSelector);
        $$.setKeyNames(["NrOrden"]);
        buildCustomFilters();
    }

    // ========================================================================
    // Custom filters
    // ========================================================================
    function buildCustomFilters() {
        // Tipo de Orden
        bound.execPPL("GetTiposOrden()").then(function(result) {
            var tipos = transformData(result);
            var menu = $('#filter-0');
            menu.empty();

            var all = $('<a class="dropdown-item" href="javascript:void(0)">Todos</a>');
            all.on('click', function(e) {
                e.preventDefault(); e.stopPropagation();
                dataTable.column(1).search('').draw();
                $('#dropdownTipo').text('Todos');
            });
            menu.append(all);

            tipos.forEach(function(t) {
                var val = t.TipoOrden;
                var item = $('<a class="dropdown-item" href="javascript:void(0)">' + val + '</a>');
                item.on('click', function(e) {
                    e.preventDefault(); e.stopPropagation();
                    dataTable.column(1).search(val).draw();
                    $('#dropdownTipo').text(val);
                });
                menu.append(item);
            });
        });

        // Estado
        bound.execPPL("GetEstados()").then(function(result) {
            var estados = transformData(result);
            var menu = $('#filter-4');
            menu.empty();

            var all = $('<a class="dropdown-item" href="javascript:void(0)">Todos</a>');
            all.on('click', function(e) {
                e.preventDefault(); e.stopPropagation();
                dataTable.column(6).search('').draw();
                $('#dropdownEstado').text('Todos');
            });
            menu.append(all);

            estados.forEach(function(e) {
                var val = e.Estado;
                var item = $('<a class="dropdown-item" href="javascript:void(0)">' + val + '</a>');
                item.on('click', function(ev) {
                    ev.preventDefault(); ev.stopPropagation();
                    dataTable.column(6).search(val).draw();
                    $('#dropdownEstado').text(val);
                });
                menu.append(item);
            });
        });
    }

    // ========================================================================
    // Statistics
    // ========================================================================
    function loadStatistics() {
        bound.execPPL("GetEstadisticas()").then(function(result) {
            var stats = result;

            if (Array.isArray(result) && result.length > 0) {
                if (Array.isArray(result[0])) stats = transformRow(result[0]);
                else if (result[0].key !== undefined) stats = transformRow(result);
                else stats = result[0] || result;
            }

            if (!stats) return;

            $('#stat-total').text(stats.TotalOrdenes || 0);
            $('#stat-pendientes').text(stats.Pendientes || 0);
            $('#stat-ejecutadas').text(stats.Ejecutadas || 0);
            $('#stat-monto-arp').text('$ ' + $$.numberFormat(stats.MontoTotalARP || 0, 2, false, false));
            $('#stat-monto-usd').text('U$S ' + $$.numberFormat(stats.MontoTotalUSD || 0, 2, false, false));
        }).catch(function(err) {
            console.error('Error cargando estadisticas:', err);
        });
    }

    // ========================================================================
    // Event listeners
    // ========================================================================
    function setupEventListeners() {
        $('#btn-refresh').on('click', refreshData);

        $('#dt1 tbody').on('click', 'td.details-control', function() {
            var tr = $(this).closest('tr');
            var row = dataTable.row(tr);

            if (row.child.isShown()) {
                row.child.hide();
                tr.removeClass('shown');
            } else {
                loadDetalleOrden(row.data().NrOrden, row, tr);
            }
        });

        $('#dt1 tbody').on('dblclick', 'tr', function() {
            var row = dataTable.row(this);
            if (row.data()) openModalDetalle(row.data().NrOrden);
        });
    }

    // ========================================================================
    // Order detail
    // ========================================================================
    function loadDetalleOrden(nrOrden, row, tr) {
        $$.loading(true);

        bound.execPPL("GetDetalleOrden('" + nrOrden + "')").then(function(result) {
            $$.loading(false);
            var detalle = transformData(result);

            if (!detalle || detalle.length === 0) {
                row.child('<div class="p-3 text-muted">Sin detalle disponible</div>').show();
                tr.addClass('shown');
                return;
            }

            var html = '<table class="table table-sm mb-0" style="font-size:12px">';
            html += '<thead><tr style="background:#f4f5f6">';
            html += '<th>#</th><th>Especie</th><th>Descripción</th><th>Cantidad</th><th>Precio</th><th>Importe</th><th>Aranceles</th><th>Der. Bolsa</th><th>Der. Mercado</th>';
            html += '</tr></thead><tbody>';

            detalle.forEach(function(d) {
                html += '<tr>';
                html += '<td>' + (d.NroItem || 1) + '</td>';
                html += '<td><strong>' + (d.Especie || '-') + '</strong></td>';
                html += '<td>' + (d.EspecieNombre || '-') + '</td>';
                html += '<td class="text-right">' + $$.numberFormat(d.Cantidad || 0, 0, false, false) + '</td>';
                html += '<td class="text-right">' + $$.numberFormat(d.Precio || 0, 2, false, false) + '</td>';
                html += '<td class="text-right">' + $$.numberFormat(d.Importe || 0, 2, false, false) + '</td>';
                html += '<td class="text-right">' + $$.numberFormat(d.Aranceles || 0, 2, false, false) + '</td>';
                html += '<td class="text-right">' + $$.numberFormat(d.DerechoBolsa || 0, 2, false, false) + '</td>';
                html += '<td class="text-right">' + $$.numberFormat(d.DerechoMercado || 0, 2, false, false) + '</td>';
                html += '</tr>';
            });

            html += '</tbody></table>';
            row.child(html).show();
            tr.addClass('shown');
        }).catch(function(err) {
            $$.loading(false);
            console.error('Error cargando detalle:', err);
        });
    }

    function openModalDetalle(nrOrden) {
        $('#modal-nro-orden').text(nrOrden);
        $('#modalDetalle').modal('show');

        bound.execPPL("GetDetalleOrden('" + nrOrden + "')").then(function(result) {
            var detalle = transformData(result);
            var tbody = $('#dt-detalle tbody');
            tbody.empty();

            if (!detalle || detalle.length === 0) {
                tbody.append('<tr><td colspan="9" class="text-center text-muted">Sin detalle</td></tr>');
                return;
            }

            detalle.forEach(function(d) {
                tbody.append(
                    '<tr>' +
                    '<td>' + (d.NroItem || 1) + '</td>' +
                    '<td><strong>' + (d.Especie || '-') + '</strong></td>' +
                    '<td>' + (d.EspecieNombre || '-') + '</td>' +
                    '<td class="text-right">' + $$.numberFormat(d.Cantidad || 0, 0, false, false) + '</td>' +
                    '<td class="text-right">' + $$.numberFormat(d.Precio || 0, 2, false, false) + '</td>' +
                    '<td class="text-right">' + $$.numberFormat(d.Importe || 0, 2, false, false) + '</td>' +
                    '<td class="text-right">' + $$.numberFormat(d.Aranceles || 0, 2, false, false) + '</td>' +
                    '<td class="text-right">' + $$.numberFormat(d.DerechoBolsa || 0, 2, false, false) + '</td>' +
                    '<td class="text-right">' + $$.numberFormat(d.DerechoMercado || 0, 2, false, false) + '</td>' +
                    '</tr>'
                );
            });
        }).catch(function(err) {
            console.error('Error cargando detalle modal:', err);
        });
    }

    // ========================================================================
    // Refresh
    // ========================================================================
    function refreshData() {
        $$.loading(true);

        bound.execPPL("GetOrdenes()").then(function(result) {
            ordenesData = transformData(result);
            $$.setData(ordenesData, colsConfig);
            loadStatistics();
            $$.loading(false);
            showToast('Datos actualizados');
        }).catch(function(err) {
            $$.loading(false);
            console.error('Error actualizando:', err);
            showToast('Error al actualizar', 'error');
        });
    }

    // ========================================================================
    // WebSocket
    // ========================================================================
    function setupWebSocketConnection() {
        console.log('ESTOR2: Conectando WS:', HUB_URL);

        hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(HUB_URL, {
                transport: signalR.HttpTransportType.WebSockets,
                withCredentials: true
            })
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: function(ctx) {
                    if (ctx.previousRetryCount < MAX_RECONNECT_ATTEMPTS) {
                        return Math.min(RECONNECT_DELAY_MS * Math.pow(2, ctx.previousRetryCount), 30000);
                    }
                    return null;
                }
            })
            .configureLogging(signalR.LogLevel.Information)
            .build();

        setupHubEventHandlers();
        startConnection();
    }

    function setupHubEventHandlers() {
        hubConnection.on('ReceiveMessage', function(messageCode, payload) {
            console.log('ESTOR2: Mensaje recibido:', messageCode, payload);
            if (messageCode === 'ESTOR2') handleMessage(payload);
        });

        hubConnection.onreconnecting(function() {
            updateWsStatus('reconnecting');
            showToast('Reconectando...', 'info');
        });

        hubConnection.onreconnected(function() {
            reconnectAttempts = 0;
            updateWsStatus('connected');
            showToast('Conexión restablecida', 'success');
            refreshData();
        });

        hubConnection.onclose(function() {
            updateWsStatus('disconnected');
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                setTimeout(startConnection, RECONNECT_DELAY_MS * reconnectAttempts);
            }
        });
    }

    function startConnection() {
        hubConnection.start()
            .then(function() {
                reconnectAttempts = 0;
                updateWsStatus('connected');
                return hubConnection.invoke('Subscribe', 'ESTOR2');
            })
            .then(function() {
                console.log('ESTOR2: Suscrito');
                showToast('Conectado en tiempo real', 'success');
            })
            .catch(function(err) {
                console.error('Error WS:', err);
                updateWsStatus('error');
                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    setTimeout(startConnection, RECONNECT_DELAY_MS * reconnectAttempts);
                }
            });
    }

    function handleMessage(payload) {
        var action = payload.action || 'updated';
        var data = payload.data;

        switch (action) {
            case 'created':
                showToast('Nueva orden: #' + (data && data.NrOrden || ''), 'info');
                refreshData();
                break;
            case 'updated':
                showToast('Orden actualizada: #' + (data && data.NrOrden || ''), 'info');
                if (data && data.NrOrden) updateSingleRow(data);
                else refreshData();
                break;
            case 'deleted':
                showToast('Orden eliminada: #' + (data && data.NrOrden || ''), 'info');
                refreshData();
                break;
            default:
                refreshData();
        }

        loadStatistics();
    }

    function updateSingleRow(orderData) {
        if (!dataTable || !orderData || !orderData.NrOrden) {
            refreshData();
            return;
        }

        var found = false;
        dataTable.rows().every(function() {
            if (this.data() && this.data().NrOrden === orderData.NrOrden) {
                this.data(orderData).draw(false);
                found = true;
                return false;
            }
        });

        if (!found) refreshData();
    }

    // ========================================================================
    // UI helpers
    // ========================================================================
    function updateWsStatus(status) {
        var el = $('#ws-status');
        switch (status) {
            case 'connected':
                el.html('<span class="estor2-ws-dot connected"></span> Conectado');
                break;
            case 'reconnecting':
                el.html('<span class="estor2-ws-dot"></span> Reconectando...');
                break;
            case 'disconnected':
            case 'error':
                el.html('<span class="estor2-ws-dot error"></span> Desconectado');
                break;
            default:
                el.html('<span class="estor2-ws-dot"></span> Conectando...');
        }
    }

    function showToast(message, type) {
        type = type || 'info';
        var toast = $('<div class="estor2-toast ' + type + '">' + message + '</div>');
        $('body').append(toast);
        setTimeout(function() { toast.fadeOut(300, function() { toast.remove(); }); }, 3000);
    }

    // ========================================================================
    // Navigation prevention & cleanup
    // ========================================================================
    $(document).on('click', 'a[href="#"], a[href=""], a:not([href])', function(e) {
        e.preventDefault();
        e.stopPropagation();
    });

    window.addEventListener('beforeunload', function() {
        if (hubConnection) hubConnection.stop();
    });

    $(document).ready(function() { init(); });

})();
