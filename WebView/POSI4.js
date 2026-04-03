/* ============================================================================
   JavaScript: Posiciones y Resultados - POSI4
   ============================================================================
   Dashboard con filtros, graficos de valuacion y actualizacion via WebSocket
   ============================================================================ */

(function() {
    'use strict';

    var dataTable = null;
    var posicionesData = [];
    var hubConnection = null;
    var reconnectAttempts = 0;
    var MAX_RECONNECT_ATTEMPTS = 10;
    var RECONNECT_DELAY_MS = 3000;
    var chartUsd = null;
    var chartArp = null;

    var API_BASE_URL = window.API_BASE_URL || 'https://localhost:44300';
    var HUB_URL = API_BASE_URL + '/hubs/ppl';

    // ========================================================================
    // Key mapping
    // ========================================================================
    var keyMap = {
        // Posiciones
        'especie': 'Especie', 'Especie': 'Especie',
        'especienombre': 'EspecieNombre', 'EspecieNombre': 'EspecieNombre',
        'contraespecie': 'ContraEspecie', 'ContraEspecie': 'ContraEspecie',
        'book': 'Book', 'Book': 'Book',
        'posinicial': 'PosInicial', 'PosInicial': 'PosInicial', 'posInicial': 'PosInicial',
        'compras': 'Compras', 'Compras': 'Compras',
        'ventas': 'Ventas', 'Ventas': 'Ventas',
        'posicionneta': 'PosicionNeta', 'PosicionNeta': 'PosicionNeta', 'posicionNeta': 'PosicionNeta',
        'preciofin': 'PrecioFin', 'PrecioFin': 'PrecioFin', 'precioFin': 'PrecioFin',
        'valuacion': 'Valuacion', 'Valuacion': 'Valuacion',
        // Resultados
        'tipoop': 'TipoOp', 'TipoOp': 'TipoOp', 'tipoOp': 'TipoOp',
        'nroperacion': 'NrOperacion', 'NrOperacion': 'NrOperacion', 'nrOperacion': 'NrOperacion',
        'fechaop': 'FechaOp', 'FechaOp': 'FechaOp', 'fechaOp': 'FechaOp',
        'cliente': 'Cliente', 'Cliente': 'Cliente',
        'cantidad': 'Cantidad', 'Cantidad': 'Cantidad',
        'precio': 'Precio', 'Precio': 'Precio',
        'monto': 'Monto', 'Monto': 'Monto',
        // Lookups
        'codigo': 'Codigo', 'Codigo': 'Codigo',
        'nombre': 'Nombre', 'Nombre': 'Nombre',
        'descripcion': 'Descripcion', 'Descripcion': 'Descripcion'
    };

    function capitalizeKey(key) {
        if (!key) return key;
        // Buscar directo primero (evita lowercase innecesario), luego por lowercase
        return keyMap[key] || keyMap[key.toLowerCase()] || (key.charAt(0).toUpperCase() + key.slice(1));
    }

    function transformRow(row) {
        if (!row || !Array.isArray(row)) return row;
        var obj = {};
        row.forEach(function(item) {
            if (!item) return;
            // Soportar tanto {key, value} (lowercase) como {Key, Value} (PascalCase)
            var k = item.key !== undefined ? item.key : item.Key;
            var v = item.value !== undefined ? item.value : item.Value;
            if (k !== undefined) {
                obj[capitalizeKey(String(k))] = typeof v === 'string' ? v.trim() : v;
            }
        });
        return obj;
    }

    function transformData(data) {
        if (!data) return [];
        // Unwrap {result: [...]} wrapper
        if (data.result !== undefined) data = data.result;
        if (!Array.isArray(data)) {
            // Single object → wrap in array
            if (data && typeof data === 'object') return [normalizeRow(data)];
            return [];
        }
        if (data.length === 0) return [];
        // Array of arrays (KVP format from PPLDic)
        if (Array.isArray(data[0])) return data.map(transformRow);
        // Array of objects
        return data.map(normalizeRow);
    }

    function normalizeRow(row) {
        if (!row || typeof row !== 'object') return row;
        // If object has 'key'/'Key' props, it's a single KVP — shouldn't happen at row level
        var obj = {};
        Object.keys(row).forEach(function(k) {
            obj[capitalizeKey(k)] = typeof row[k] === 'string' ? row[k].trim() : row[k];
        });
        return obj;
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
        { data: 'Book', title: 'Book' },
        {
            data: 'PosInicial',
            title: 'Pos. Inicial',
            render: function(data, type) {
                if (type === 'display') {
                    var v = data || 0;
                    var cls = v < 0 ? ' style="color:#dc3545"' : v > 0 ? ' style="color:#28a745"' : '';
                    return '<span' + cls + '>' + $$.numberFormat(v, 0, false, false) + '</span>';
                }
                return data;
            }
        },
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
            title: 'Posici\u00f3n Neta',
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
            data: 'PrecioFin',
            title: 'Precio Fin',
            render: function(data, type) {
                return type === 'display' ? $$.numberFormat(data || 0, 4, false, false) : data;
            }
        },
        {
            data: 'Valuacion',
            title: 'Valuaci\u00f3n',
            render: function(data, type) {
                if (type === 'display') {
                    var v = data || 0;
                    var cls = v < 0 ? ' style="color:#dc3545"' : '';
                    return '<strong' + cls + '>' + $$.numberFormat(v, 2, false, false) + '</strong>';
                }
                return data;
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
        setupEventListeners();
        setupWebSocketConnection();

        console.log('POSI4: Inicializado');
    }

    // ========================================================================
    // Load filters
    // ========================================================================
    function loadFilters() {
        bound.execPPL("GetBooks()").then(function(result) {
            var books = transformData(result);
            var select = $('#filter-book');
            books.forEach(function(b) {
                select.append('<option value="' + b.Codigo + '">' + b.Codigo + '</option>');
            });
        });
    }

    // ========================================================================
    // Filter params
    // ========================================================================
    function getFilterParams() {
        var fecha = $('#filter-fecha').val() || new Date().toISOString().split('T')[0];
        var especie = ($('#filter-especie').val() || '').trim();
        var bookVal = $('#filter-book').val();
        var book = bookVal ? "'" + bookVal + "'" : '';
        var tipoEspecie = $('#filter-tipo-especie').val() || '';
        return { fecha: fecha, especie: especie, book: book, tipoEspecie: tipoEspecie };
    }

    function buildGetPosicionesCall(p) {
        return 'GetPosiciones("' + p.fecha + '", "' + p.especie + '", "' + p.book + '", "' + p.tipoEspecie + '")';
    }

    // ========================================================================
    // Load data
    // ========================================================================
    function loadInitialData() {
        var p = getFilterParams();
        bound.execPPL(buildGetPosicionesCall(p)).then(function(result) {
            console.log('POSI4: Raw result type:', typeof result, Array.isArray(result) ? 'array[' + result.length + ']' : '');
            if (result && (Array.isArray(result) ? result.length > 0 : true)) {
                var sample = Array.isArray(result) ? result[0] : result;
                console.log('POSI4: First row raw:', JSON.stringify(sample).substring(0, 300));
            }
            posicionesData = transformData(result);
            console.log('POSI4: Posiciones cargadas:', posicionesData.length);
            if (dataTable) $$.setData(posicionesData, colsConfig);
            renderCharts(posicionesData);
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
                info: "P\u00e1gina _PAGE_ de _PAGES_",
                infoEmpty: "",
                infoFiltered: "(filtrado de _MAX_ registros)",
                search: "Buscar:",
                lengthMenu: "Mostrar _MENU_",
                paginate: { first: "Primera", last: "\u00daltima", next: ">", previous: "<" }
            },
            order: [[3, 'asc'], [1, 'asc']]
        });

        $$.setDataTable(dataTable, dtSelector);
        $$.setKeyNames(["Especie", "Book"]);
    }

    // ========================================================================
    // Charts (Chart.js)
    // ========================================================================
    function renderCharts(data) {
        if (typeof Chart === 'undefined') {
            console.warn('POSI4: Chart.js no disponible');
            return;
        }

        // Agrupar valuacion por especie y contraespecie
        var usdData = {};
        var arpData = {};

        (data || []).forEach(function(row) {
            var esp = row.Especie || '';
            var cEsp = (row.ContraEspecie || '').toUpperCase();
            var val = parseFloat(row.Valuacion) || 0;
            if (val === 0) return;

            if (cEsp === 'USD' || cEsp === 'D') {
                usdData[esp] = (usdData[esp] || 0) + val;
            } else if (cEsp === 'ARP' || cEsp === 'ARS' || cEsp === '$') {
                arpData[esp] = (arpData[esp] || 0) + val;
            }
        });

        chartUsd = buildBarChart('chart-usd', chartUsd, usdData, 'Valuaci\u00f3n USD');
        chartArp = buildBarChart('chart-arp', chartArp, arpData, 'Valuaci\u00f3n ARP');
    }

    function buildBarChart(canvasId, existingChart, dataMap, label) {
        var labels = Object.keys(dataMap).sort();
        var values = labels.map(function(k) { return dataMap[k]; });
        var colors = values.map(function(v) { return v >= 0 ? '#28a745' : '#dc3545'; });

        if (existingChart) existingChart.destroy();

        var ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: values,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                return ctx.parsed.y.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString('es-AR', { maximumFractionDigits: 0 });
                            },
                            font: { size: 10 }
                        },
                        grid: { color: '#eee' }
                    },
                    x: {
                        ticks: { font: { size: 10 }, maxRotation: 45 },
                        grid: { display: false }
                    }
                }
            }
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
    // Results detail (operaciones del dia)
    // ========================================================================
    function loadResultados(posData, row, tr) {
        if (!posData) return;

        var fecha = $('#filter-fecha').val() || new Date().toISOString().split('T')[0];
        var call = 'GetResultados("' + (posData.Especie || '') + '", "' +
                   (posData.Book || '') + '", "' + fecha + '")';

        bound.execPPL(call).then(function(result) {
            var ops = transformData(result);

            var html = '<table class="table table-sm mb-0" style="font-size:12px">';
            html += '<thead><tr style="background:#f4f5f6">';
            html += '<th>Tipo</th><th>Nro</th><th>Fecha</th><th>Cliente</th><th class="text-right">Cantidad</th><th class="text-right">Precio</th><th class="text-right">Monto</th>';
            html += '</tr></thead><tbody>';

            if (!ops || ops.length === 0) {
                html += '<tr><td colspan="7" class="text-center text-muted">Sin operaciones en este d\u00eda</td></tr>';
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
        bound.execPPL(buildGetPosicionesCall(p)).then(function(result) {
            posicionesData = transformData(result);
            $$.setData(posicionesData, colsConfig);
            renderCharts(posicionesData);
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
                showToast('Operaci\u00f3n registrada - actualizando...', 'info');
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
