/* ============================================================================
   JavaScript: Posiciones y Resultados en Tiempo Real
   ============================================================================
   Dashboard con filtros y actualizacion automatica via WebSocket
   ============================================================================ */

(function() {
    'use strict';

    var dataTable = null;
    var posicionesData = [];
    var hubConnection = null;
    var reconnectAttempts = 0;
    var MAX_RECONNECT_ATTEMPTS = 10;
    var RECONNECT_DELAY_MS = 3000;

    var API_BASE_URL = window.API_BASE_URL || 'https://localhost:44300';
    var HUB_URL = API_BASE_URL + '/hubs/ppl';

    // ========================================================================
    // Key mapping
    // ========================================================================
    var keyMap = {
        'especie': 'Especie',
        'especienombre': 'EspecieNombre',
        'contraespecie': 'ContraEspecie',
        'vehiculo': 'Vehiculo',
        'vehiculonombre': 'VehiculoNombre',
        'book': 'Book',
        'compras': 'Compras',
        'ventas': 'Ventas',
        'posicionneta': 'PosicionNeta',
        'precioprom': 'PrecioProm',
        'valuacion': 'Valuacion',
        'cantops': 'CantOps',
        'tipoop': 'TipoOp',
        'nroperacion': 'NrOperacion',
        'fechaop': 'FechaOp',
        'cliente': 'Cliente',
        'cantidad': 'Cantidad',
        'precio': 'Precio',
        'monto': 'Monto',
        'totalespecies': 'TotalEspecies',
        'totalvehiculos': 'TotalVehiculos',
        'totaltitulos': 'TotalTitulos',
        'totalfx': 'TotalFX',
        'codigo': 'Codigo',
        'descripcion': 'Descripcion'
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
    // NrSaldo label
    // ========================================================================
    function saldoLabel(nrSaldo) {
        var labels = {
            171: 'Titulos', 172: 'Titulos',
            31: 'FX', 51: 'FX',
            43: 'OCT', 44: 'Rofex',
            45: 'Int. FX Exp.', 41: 'FX DF',
            42: 'FX NDF', 137: 'Otros', 136: 'Otros'
        };
        return labels[nrSaldo] || 'Saldo ' + nrSaldo;
    }

    // ========================================================================
    // DataTable columns
    // ========================================================================
    var colsConfig = [
        { className: 'details-control', orderable: false, data: null, defaultContent: '' },
        {
            data: 'Especie',
            title: 'Especie',
            render: function(data, type, row) {
                if (type === 'display') {
                    var nombre = row.EspecieNombre || '';
                    return '<strong>' + (data || '') + '</strong>' + (nombre ? '<br><small class="text-muted">' + nombre + '</small>' : '');
                }
                return data;
            }
        },
        { data: 'ContraEspecie', title: 'C.Esp.' },
        {
            data: 'Vehiculo',
            title: 'Vehículo',
            render: function(data, type, row) {
                if (type === 'display') {
                    var nombre = row.VehiculoNombre || '';
                    return (data || '') + (nombre ? ' - ' + nombre : '');
                }
                return data;
            }
        },
        { data: 'Book', title: 'Book' },
        {
            data: 'Compras',
            title: 'Compras',
            render: function(data, type) {
                return type === 'display' ? $$.numberFormat(data || 0, 0, false, false) : data;
            }
        },
        {
            data: 'Ventas',
            title: 'Ventas',
            render: function(data, type) {
                return type === 'display' ? $$.numberFormat(data || 0, 0, false, false) : data;
            }
        },
        {
            data: 'PosicionNeta',
            title: 'Posición Neta',
            render: function(data, type) {
                if (type === 'display') {
                    var v = data || 0;
                    var cls = v < 0 ? ' style="color:#dc3545"' : v > 0 ? ' style="color:#28a745"' : '';
                    return '<strong' + cls + '>' + $$.numberFormat(v, 0, false, false) + '</strong>';
                }
                return data;
            }
        },
        {
            data: 'PrecioProm',
            title: 'Precio Prom.',
            render: function(data, type) {
                return type === 'display' ? $$.numberFormat(data || 0, 4, false, false) : data;
            }
        },
        {
            data: 'Valuacion',
            title: 'Valuación',
            render: function(data, type) {
                if (type === 'display') {
                    var v = data || 0;
                    var cls = v < 0 ? ' style="color:#dc3545"' : '';
                    return '<strong' + cls + '>' + $$.numberFormat(v, 2, false, false) + '</strong>';
                }
                return data;
            }
        },
        {
            data: 'CantOps',
            title: 'Ops',
            render: function(data, type) {
                return type === 'display' ? '<span class="badge badge-secondary">' + (data || 0) + '</span>' : data;
            }
        }
    ];

    // ========================================================================
    // Init
    // ========================================================================
    function init() {
        console.log('POSI4: Inicializando...');

        var today = new Date().toISOString().split('T')[0];
        $('#filter-fecha').val(today);

        loadFilters();
        initDataTable();
        loadInitialData();
        loadStatistics();
        setupEventListeners();
        setupWebSocketConnection();

        console.log('POSI4: Inicializado');
    }

    // ========================================================================
    // Load filters
    // ========================================================================
    function loadFilters() {
        bound.execPPL("GetVehiculos()").then(function(result) {
            var vehiculos = transformData(result);
            var select = $('#filter-vehiculo');
            vehiculos.forEach(function(v) {
                select.append('<option value="' + v.Codigo + '">' + v.Codigo + ' - ' + (v.Descripcion || '') + '</option>');
            });
        });

        bound.execPPL("GetBooks()").then(function(result) {
            var books = transformData(result);
            var select = $('#filter-book');
            books.forEach(function(b) {
                select.append('<option value="' + b.Codigo + '">' + b.Codigo + '</option>');
            });
        });
    }

    // ========================================================================
    // Load data
    // ========================================================================
    function getFilterParams() {
        var fecha = $('#filter-fecha').val() || new Date().toISOString().split('T')[0];
        var especie = $('#filter-especie').val() || '';
        var vehiculo = $('#filter-vehiculo').val() || '';
        var bookVal = $('#filter-book').val();
        var book = bookVal ? "'" + bookVal + "'" : '';
        var pesos = $('#filter-pesos').val() || '0';
        return { fecha: fecha, especie: especie, vehiculo: vehiculo, book: book, pesos: pesos };
    }

    function loadInitialData() {
        var p = getFilterParams();
        var call = 'GetPosiciones("' + p.fecha + '", "' + p.especie + '", "' + p.vehiculo + '", "' + p.book + '", "' + p.pesos + '")';

        bound.execPPL(call).then(function(result) {
            posicionesData = transformData(result);
            console.log('POSI4: Posiciones cargadas:', posicionesData.length);
            if (dataTable) $$.setData(posicionesData, colsConfig);
        }).catch(function(err) {
            console.error('Error cargando posiciones:', err);
            showToast('Error al cargar posiciones', 'error');
        });
    }

    function initDataTable() {
        var dtSelector = '#dt1';

        dataTable = $(dtSelector).DataTable({
            scrollX: true,
            searching: true,
            lengthChange: true,
            pageLength: 50,
            data: posicionesData,
            columns: colsConfig,
            language: {
                zeroRecords: "No se encontraron posiciones",
                info: "Página _PAGE_ de _PAGES_",
                infoEmpty: "",
                infoFiltered: "(filtrado de _MAX_ registros)",
                search: "Buscar:",
                lengthMenu: "Mostrar _MENU_",
                paginate: { first: "Primera", last: "Última", next: ">", previous: "<" }
            },
            order: [[3, 'asc'], [4, 'asc'], [1, 'asc']]
        });

        $$.setDataTable(dataTable, dtSelector);
        $$.setKeyNames(["Especie", "Vehiculo", "Book", "NrSaldo"]);
    }

    // ========================================================================
    // Statistics
    // ========================================================================
    function loadStatistics() {
        var fecha = $('#filter-fecha').val() || new Date().toISOString().split('T')[0];
        bound.execPPL('GetEstadisticasPosiciones("' + fecha + '")').then(function(result) {
            var stats = result;
            if (Array.isArray(result) && result.length > 0) {
                if (Array.isArray(result[0])) stats = transformRow(result[0]);
                else if (result[0].key !== undefined) stats = transformRow(result);
                else stats = result[0] || result;
            }
            if (!stats) return;

            $('#stat-especies').text(stats.TotalEspecies || 0);
            $('#stat-vehiculos').text(stats.TotalVehiculos || 0);
            $('#stat-titulos').text($$.numberFormat(stats.TotalTitulos || 0, 0, false, false));
            $('#stat-fx').text($$.numberFormat(stats.TotalFX || 0, 0, false, false));
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
                loadResultados(row.data(), row, tr);
            }
        });
    }

    // ========================================================================
    // Results detail
    // ========================================================================
    function loadResultados(posData, row, tr) {
        if (!posData) return;

        var fecha = $('#filter-fecha').val() || new Date().toISOString().split('T')[0];
        var call = 'GetResultados("' + (posData.Especie || '') + '", "' + (posData.Vehiculo || '') + '", "' +
                   (posData.Book || '') + '", 0, "' + fecha + '")';

        bound.execPPL(call).then(function(result) {
            var ops = transformData(result);

            var html = '<table class="table table-sm mb-0" style="font-size:12px">';
            html += '<thead><tr style="background:#f4f5f6">';
            html += '<th>Tipo</th><th>Nro</th><th>Fecha</th><th>Cliente</th><th class="text-right">Cantidad</th><th class="text-right">Precio</th><th class="text-right">Monto</th>';
            html += '</tr></thead><tbody>';

            if (!ops || ops.length === 0) {
                html += '<tr><td colspan="7" class="text-center text-muted">Sin operaciones</td></tr>';
            } else {
                ops.forEach(function(o) {
                    var cls = (o.TipoOp || '').indexOf('TIC') >= 0 || o.TipoOp === 'COMPRA' ? 'badge-dark' : 'badge-secondary';
                    html += '<tr>';
                    html += '<td><span class="badge ' + cls + '">' + (o.TipoOp || '-') + '</span></td>';
                    html += '<td>' + (o.NrOperacion || '-') + '</td>';
                    html += '<td>' + (o.FechaOp || '-') + '</td>';
                    html += '<td>' + (o.Cliente || '-') + '</td>';
                    html += '<td class="text-right">' + $$.numberFormat(o.Cantidad || 0, 0, false, false) + '</td>';
                    html += '<td class="text-right">' + $$.numberFormat(o.Precio || 0, 4, false, false) + '</td>';
                    html += '<td class="text-right">' + $$.numberFormat(o.Monto || 0, 2, false, false) + '</td>';
                    html += '</tr>';
                });
            }

            html += '</tbody></table>';
            row.child(html).show();
            tr.addClass('shown');
        }).catch(function(err) {
            console.error('Error cargando detalle:', err);
            row.child('<div class="p-3 text-muted">Error al cargar detalle</div>').show();
            tr.addClass('shown');
        });
    }

    // ========================================================================
    // Refresh
    // ========================================================================
    function refreshData() {
        $$.loading(true);

        var p = getFilterParams();
        var call = 'GetPosiciones("' + p.fecha + '", "' + p.especie + '", "' + p.vehiculo + '", "' + p.book + '", "' + p.pesos + '")';

        bound.execPPL(call).then(function(result) {
            posicionesData = transformData(result);
            $$.setData(posicionesData, colsConfig);
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
        console.log('POSI4: Conectando WS:', HUB_URL);

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
            console.log('POSI4: Mensaje recibido:', messageCode, payload);
            if (messageCode === 'POSI4') {
                showToast('Operación registrada - actualizando...', 'info');
                refreshData();
            }
        });

        hubConnection.onreconnecting(function() { updateWsStatus('reconnecting'); });
        hubConnection.onreconnected(function() {
            reconnectAttempts = 0;
            updateWsStatus('connected');
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
                return hubConnection.invoke('Subscribe', 'POSI4');
            })
            .then(function() {
                console.log('POSI4: Suscrito');
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

    // ========================================================================
    // UI helpers
    // ========================================================================
    function updateWsStatus(status) {
        var el = $('#ws-status');
        switch (status) {
            case 'connected':
                el.html('<span class="posi4-ws-dot connected"></span> Conectado');
                break;
            case 'reconnecting':
                el.html('<span class="posi4-ws-dot"></span> Reconectando...');
                break;
            case 'disconnected':
            case 'error':
                el.html('<span class="posi4-ws-dot error"></span> Desconectado');
                break;
            default:
                el.html('<span class="posi4-ws-dot"></span> Conectando...');
        }
    }

    function showToast(message, type) {
        type = type || 'info';
        var toast = $('<div class="posi4-toast ' + type + '">' + message + '</div>');
        $('body').append(toast);
        setTimeout(function() { toast.fadeOut(300, function() { toast.remove(); }); }, 3000);
    }

    // ========================================================================
    // Cleanup
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
