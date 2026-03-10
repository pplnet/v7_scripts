/* ============================================================================
   JavaScript: Estado de Ordenes en Tiempo Real
   ============================================================================
   Logica de interactividad, comunicacion con backend PPL y actualizaciones
   en tiempo real via WebSocket (SignalR)
   Endpoint de notificaciones: https://localhost:44300/notifications
   ============================================================================ */

(function() {
    'use strict';

    // Variables globales
    let dataTable = null;
    let ordenesData = [];
    let hubConnection = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 10;
    const RECONNECT_DELAY_MS = 3000;

    // URL base del API - sin /api/ al inicio
    const API_BASE_URL = window.API_BASE_URL || 'https://localhost:44300';
    const NOTIFICATIONS_URL = API_BASE_URL + '/notifications';
    const HUB_URL = API_BASE_URL + '/hubs/ppl';

    // ========================================================================
    // Transformador de datos del backend
    // ========================================================================
    function transformRow(row) {
        if (!row || !Array.isArray(row)) return row;

        const obj = {};
        row.forEach(function(item) {
            if (item && item.key !== undefined) {
                const key = capitalizeKey(item.key);
                obj[key] = typeof item.value === 'string' ? item.value.trim() : item.value;
            }
        });
        return obj;
    }

    function transformData(data) {
        if (!data) return [];

        if (data.result && Array.isArray(data.result)) {
            data = data.result;
        }

        if (!Array.isArray(data)) return [];

        if (data.length > 0 && Array.isArray(data[0])) {
            return data.map(transformRow);
        }

        return data.map(function(row) {
            if (row && typeof row === 'object' && !Array.isArray(row)) {
                const obj = {};
                Object.keys(row).forEach(function(key) {
                    const newKey = capitalizeKey(key);
                    obj[newKey] = typeof row[key] === 'string' ? row[key].trim() : row[key];
                });
                return obj;
            }
            return row;
        });
    }

    // Mapeo de claves - actualizado para columnas reales de ORDENES
    function capitalizeKey(key) {
        if (!key) return key;
        const keyMap = {
            'tipoorden': 'TipoOrden',
            'nrorden': 'NrOrden',
            'nroorden': 'NrOrden',
            'fechaorden': 'FechaOrden',
            'cliente': 'Cliente',
            'estado': 'Estado',
            'monto': 'Monto',
            'operador': 'Operador',
            'especie': 'Especie',
            'cantidad': 'Cantidad',
            'cantidadtotalorden': 'CantidadTotalOrden',
            'preciolimite': 'PrecioLimite',
            'precio': 'Precio',
            'importe': 'Importe',
            'comision': 'Comision',
            'nroitem': 'NroItem',
            'totalordenes': 'TotalOrdenes',
            'pendientes': 'Pendientes',
            'ejecutadas': 'Ejecutadas',
            'canceladas': 'Canceladas',
            'montototal': 'MontoTotal',
            'montopromedio': 'MontoPromedio',
            'mercado': 'Mercado',
            'direccion': 'Direccion'
        };

        const lowerKey = key.toLowerCase();
        if (keyMap[lowerKey]) {
            return keyMap[lowerKey];
        }

        return key.charAt(0).toUpperCase() + key.slice(1);
    }

    // ========================================================================
    // Configuracion de DataTable - columnas actualizadas
    // ========================================================================
    const colsConfig = [
        {
            "className": 'details-control',
            "orderable": false,
            "data": null,
            "defaultContent": ''
        },
        {
            "data": "TipoOrden",
            "title": "Tipo"
        },
        {
            "data": "NrOrden",
            "title": "Nro. Orden"
        },
        {
            "data": "FechaOrden",
            "title": "Fecha"
        },
        {
            "data": "Cliente",
            "title": "Cliente"
        },
        {
            "data": "Estado",
            "title": "Estado",
            "render": function(data, type, row) {
                if (type === 'display') {
                    let badgeClass = 'badge-pendiente';
                    let displayText = data;
                    // Estados reales de la tabla ORDENES
                    if (data === 'COM') {
                        badgeClass = 'badge-ejecutada';
                        displayText = 'Completada';
                    } else if (data === 'CAN') {
                        badgeClass = 'badge-cancelada';
                        displayText = 'Cancelada';
                    } else if (data === 'PEN') {
                        badgeClass = 'badge-pendiente';
                        displayText = 'Pendiente';
                    } else if (data === 'PAR') {
                        badgeClass = 'badge-warning';
                        displayText = 'Parcial';
                    } else if (data === 'PRO') {
                        badgeClass = 'badge-info';
                        displayText = 'En Proceso';
                    } else if (data === 'REC') {
                        badgeClass = 'badge-danger';
                        displayText = 'Rechazada';
                    }
                    return '<span class="badge badge-estado ' + badgeClass + '">' + displayText + '</span>';
                }
                return data;
            }
        },
        {
            "data": "Monto",
            "title": "Monto",
            "render": function(data, type, row) {
                if (type === 'display') {
                    return $$.numberFormat(data, 2, true, false);
                }
                return data;
            }
        },
        {
            "data": "Operador",
            "title": "Operador"
        }
    ];

    // ========================================================================
    // Inicializacion
    // ========================================================================
    function init() {
        console.log('Inicializando WebView de Ordenes...');
        console.log('API Base URL:', API_BASE_URL);
        console.log('Notifications URL:', NOTIFICATIONS_URL);
        console.log('Hub URL:', HUB_URL);

        loadInitialData();
        initDataTable();
        loadStatistics();
        setupEventListeners();
        setupWebSocketConnection();

        console.log('WebView inicializada correctamente');
    }

    // ========================================================================
    // Cargar datos iniciales desde PPL
    // ========================================================================
    function loadInitialData() {
        bound.execPPL("GetOrdenes()").then(function(result) {
            ordenesData = transformData(result);
            console.log('Ordenes cargadas:', ordenesData.length);

            if (dataTable) {
                $$.setData(ordenesData, colsConfig);
            }
        }).catch(function(error) {
            console.error('Error cargando ordenes:', error);
            showError('Error al cargar las ordenes');
        });
    }

    // ========================================================================
    // Inicializar DataTable
    // ========================================================================
    function initDataTable() {
        const dtSelector = '#dt1';

        dataTable = $(dtSelector).DataTable({
            scrollX: true,
            searching: true,
            lengthChange: true,
            pageLength: 25,
            data: ordenesData,
            columns: colsConfig,
            language: {
                zeroRecords: "No se encontraron ordenes",
                info: "Mostrando pagina _PAGE_ de _PAGES_",
                infoEmpty: "",
                infoFiltered: "(Filtrado de un total de _MAX_ registros)",
                search: "Buscar:",
                lengthMenu: "Mostrar _MENU_ registros",
                paginate: {
                    first: "Primera",
                    last: "Ultima",
                    next: "Siguiente >",
                    previous: "< Anterior"
                }
            },
            order: [[2, 'desc']], // Ordenar por NrOrden descendente
            rowCallback: function(row, data, index) {
                $(row).attr('data-nr-orden', data.NrOrden);
            }
        });

        $$.setDataTable(dataTable, dtSelector);
        $$.setKeyNames(["NrOrden"]);
        buildCustomFilters();

        console.log('DataTable inicializada');
    }

    // ========================================================================
    // Construir filtros personalizados
    // ========================================================================
    function buildCustomFilters() {
        // Filtro de Tipo de Orden
        bound.execPPL("GetTiposOrden()").then(function(result) {
            const tipos = transformData(result);
            const filterTipo = $('#filter-0');
            filterTipo.empty();

            // Item "Todos" con event listener
            const todosItem = $('<a class="dropdown-item" href="javascript:void(0)" data-value="">Todos</a>');
            todosItem.on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                dataTable.column(1).search('').draw();
                $('#dropdownTipo').text('Todos los tipos');
            });
            filterTipo.append(todosItem);

            tipos.forEach(function(tipo) {
                const tipoOrden = tipo.TipoOrden;
                const item = $('<a class="dropdown-item" href="javascript:void(0)" data-value="' + tipoOrden + '">' + tipoOrden + '</a>');
                item.on('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const value = $(this).data('value');
                    dataTable.column(1).search(value).draw();
                    $('#dropdownTipo').text(value || 'Todos los tipos');
                });
                filterTipo.append(item);
            });
        });

        // Filtro de Estado
        bound.execPPL("GetEstados()").then(function(result) {
            const estados = transformData(result);
            const filterEstado = $('#filter-4');
            filterEstado.empty();

            // Item "Todos" con event listener
            const todosEstadoItem = $('<a class="dropdown-item" href="javascript:void(0)" data-value="">Todos</a>');
            todosEstadoItem.on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                dataTable.column(5).search('').draw();
                $('#dropdownEstado').text('Todos los estados');
            });
            filterEstado.append(todosEstadoItem);

            estados.forEach(function(estado) {
                const estadoVal = estado.Estado;
                const item = $('<a class="dropdown-item" href="javascript:void(0)" data-value="' + estadoVal + '">' + estadoVal + '</a>');
                item.on('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const value = $(this).data('value');
                    dataTable.column(5).search(value).draw();
                    $('#dropdownEstado').text(value || 'Todos los estados');
                });
                filterEstado.append(item);
            });
        });
    }

    // ========================================================================
    // Cargar estadisticas
    // ========================================================================
    function loadStatistics() {
        bound.execPPL("GetEstadisticas()").then(function(result) {
            let stats = result;

            if (Array.isArray(result) && result.length > 0) {
                if (Array.isArray(result[0])) {
                    stats = transformRow(result[0]);
                } else if (result[0].key !== undefined) {
                    stats = transformRow(result);
                } else {
                    stats = result[0] || result;
                }
            }

            if (!stats) return;

            $('#stat-total').text(stats.TotalOrdenes || 0);
            $('#stat-pendientes').text(stats.Pendientes || 0);
            $('#stat-ejecutadas').text(stats.Ejecutadas || 0);

            const montoFormatted = $$.numberFormat(stats.MontoTotal || 0, 2, false, false);
            $('#stat-monto').text('$' + montoFormatted);
        }).catch(function(error) {
            console.error('Error cargando estadisticas:', error);
        });
    }

    // ========================================================================
    // Configurar event listeners
    // ========================================================================
    function setupEventListeners() {
        $('#btn-refresh').on('click', function() {
            refreshData();
        });

        // Click en fila para expandir detalle
        $('#dt1 tbody').on('click', 'td.details-control', function() {
            const tr = $(this).closest('tr');
            const row = dataTable.row(tr);

            if (row.child.isShown()) {
                row.child.hide();
                tr.removeClass('shown');
            } else {
                const nrOrden = row.data().NrOrden;
                loadDetalleOrden(nrOrden, row, tr);
            }
        });

        // Doble click en fila para abrir modal
        $('#dt1 tbody').on('dblclick', 'tr', function() {
            const row = dataTable.row(this);
            if (row.data()) {
                const nrOrden = row.data().NrOrden;
                openModalDetalle(nrOrden);
            }
        });
    }

    // ========================================================================
    // Cargar detalle de orden (expandible)
    // ========================================================================
    function loadDetalleOrden(nrOrden, row, tr) {
        $$.loading(true);

        bound.execPPL("GetDetalleOrden('" + nrOrden + "')").then(function(result) {
            $$.loading(false);

            const detalle = transformData(result);

            if (!detalle || detalle.length === 0) {
                row.child('<div class="p-3">No hay detalle disponible para esta orden</div>').show();
                tr.addClass('shown');
                return;
            }

            let html = '<table class="table table-sm table-bordered mb-0">';
            html += '<thead><tr>';
            html += '<th>Item</th><th>Especie</th><th>Cantidad</th><th>Precio</th><th>Importe</th><th>Comision</th>';
            html += '</tr></thead><tbody>';

            detalle.forEach(function(item) {
                html += '<tr>';
                html += '<td>' + (item.NroItem || 1) + '</td>';
                html += '<td>' + (item.Especie || '-') + '</td>';
                html += '<td>' + $$.numberFormat(item.Cantidad || 0, 2, false, false) + '</td>';
                html += '<td>' + $$.numberFormat(item.Precio || 0, 2, false, false) + '</td>';
                html += '<td>' + $$.numberFormat(item.Importe || 0, 2, false, false) + '</td>';
                html += '<td>' + $$.numberFormat(item.Comision || 0, 2, false, false) + '</td>';
                html += '</tr>';
            });

            html += '</tbody></table>';

            row.child(html).show();
            tr.addClass('shown');
        }).catch(function(error) {
            $$.loading(false);
            console.error('Error cargando detalle:', error);
            showError('Error al cargar el detalle de la orden');
        });
    }

    // ========================================================================
    // Abrir modal con detalle completo
    // ========================================================================
    function openModalDetalle(nrOrden) {
        $('#modal-nro-orden').text(nrOrden);
        $('#modalDetalle').modal('show');

        bound.execPPL("GetDetalleOrden('" + nrOrden + "')").then(function(result) {
            const detalle = transformData(result);
            const tbody = $('#dt-detalle tbody');
            tbody.empty();

            if (!detalle || detalle.length === 0) {
                tbody.append('<tr><td colspan="6" class="text-center">No hay detalle disponible</td></tr>');
                return;
            }

            detalle.forEach(function(item) {
                const row = '<tr>' +
                    '<td>' + (item.NroItem || 1) + '</td>' +
                    '<td>' + (item.Especie || '-') + '</td>' +
                    '<td class="text-right">' + $$.numberFormat(item.Cantidad || 0, 2, false, false) + '</td>' +
                    '<td class="text-right">' + $$.numberFormat(item.Precio || 0, 2, false, false) + '</td>' +
                    '<td class="text-right">' + $$.numberFormat(item.Importe || 0, 2, false, false) + '</td>' +
                    '<td class="text-right">' + $$.numberFormat(item.Comision || 0, 2, false, false) + '</td>' +
                    '</tr>';
                tbody.append(row);
            });
        }).catch(function(error) {
            console.error('Error cargando detalle en modal:', error);
        });
    }

    // ========================================================================
    // Refrescar datos
    // ========================================================================
    function refreshData() {
        $$.loading(true);

        bound.execPPL("GetOrdenes()").then(function(result) {
            ordenesData = transformData(result);
            $$.setData(ordenesData, colsConfig);
            loadStatistics();
            $$.loading(false);

            showNotification('Datos actualizados correctamente');
        }).catch(function(error) {
            $$.loading(false);
            console.error('Error actualizando datos:', error);
            showError('Error al actualizar los datos');
        });
    }

    // ========================================================================
    // Configurar conexion WebSocket con SignalR
    // ========================================================================
    function setupWebSocketConnection() {
        console.log('Conectando a WebSocket:', HUB_URL);

        hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(HUB_URL, {
                transport: signalR.HttpTransportType.WebSockets,
                withCredentials: true
            })
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: function(retryContext) {
                    if (retryContext.previousRetryCount < MAX_RECONNECT_ATTEMPTS) {
                        const delay = Math.min(
                            RECONNECT_DELAY_MS * Math.pow(2, retryContext.previousRetryCount),
                            30000
                        );
                        console.log('Reintentando conexion en ' + delay + 'ms...');
                        return delay;
                    }
                    return null;
                }
            })
            .configureLogging(signalR.LogLevel.Information)
            .build();

        setupHubEventHandlers();
        startConnection();
    }

    // ========================================================================
    // Configurar handlers de eventos del Hub
    // ========================================================================
    function setupHubEventHandlers() {
        hubConnection.on('ReceiveMessage', function(messageCode, payload) {
            console.log('Mensaje recibido:', messageCode, payload);

            if (messageCode === 'ESTORD') {
                handleESTORDMessage(payload);
            }
        });

        hubConnection.onreconnecting(function(error) {
            console.warn('Conexion perdida, reconectando...', error);
            updateConnectionStatus('reconnecting');
            showNotification('Reconectando al servidor...', 'warning');
        });

        hubConnection.onreconnected(function(connectionId) {
            console.log('Reconectado al servidor con ID:', connectionId);
            reconnectAttempts = 0;
            updateConnectionStatus('connected');
            showNotification('Conexion restablecida', 'success');
            refreshData();
        });

        hubConnection.onclose(function(error) {
            console.error('Conexion cerrada:', error);
            updateConnectionStatus('disconnected');

            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                setTimeout(startConnection, RECONNECT_DELAY_MS * reconnectAttempts);
            } else {
                showError('No se pudo conectar al servidor. Por favor, recargue la pagina.');
            }
        });
    }

    // ========================================================================
    // Iniciar conexion WebSocket
    // ========================================================================
    function startConnection() {
        hubConnection.start()
            .then(function() {
                console.log('Conexion WebSocket establecida');
                reconnectAttempts = 0;
                updateConnectionStatus('connected');

                return hubConnection.invoke('Subscribe', 'ESTORD');
            })
            .then(function() {
                console.log('Suscrito al grupo ESTORD');
                showNotification('Conectado en tiempo real', 'success');
            })
            .catch(function(error) {
                console.error('Error conectando al WebSocket:', error);
                updateConnectionStatus('error');

                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    const delay = RECONNECT_DELAY_MS * reconnectAttempts;
                    console.log('Reintentando en ' + delay + 'ms...');
                    setTimeout(startConnection, delay);
                }
            });
    }

    // ========================================================================
    // Manejar mensajes ESTORD
    // ========================================================================
    function handleESTORDMessage(payload) {
        console.log('Procesando mensaje ESTORD:', payload);

        const action = payload.action || 'updated';
        const orderData = payload.data;

        switch (action) {
            case 'created':
                showNotification('Nueva orden creada: #' + (orderData?.NrOrden || ''), 'info');
                refreshData();
                break;

            case 'updated':
                showNotification('Orden actualizada: #' + (orderData?.NrOrden || ''), 'info');
                if (orderData && orderData.NrOrden) {
                    updateSingleRow(orderData);
                } else {
                    refreshData();
                }
                break;

            case 'deleted':
                showNotification('Orden eliminada: #' + (orderData?.NrOrden || ''), 'warning');
                refreshData();
                break;

            default:
                refreshData();
        }

        loadStatistics();
    }

    // ========================================================================
    // Actualizar una fila especifica
    // ========================================================================
    function updateSingleRow(orderData) {
        if (!dataTable || !orderData || !orderData.NrOrden) {
            refreshData();
            return;
        }

        let rowFound = false;
        dataTable.rows().every(function() {
            const data = this.data();
            if (data && data.NrOrden === orderData.NrOrden) {
                this.data(orderData).draw(false);
                rowFound = true;
                return false;
            }
        });

        if (!rowFound) {
            refreshData();
        }
    }

    // ========================================================================
    // Actualizar indicador de estado de conexion
    // ========================================================================
    function updateConnectionStatus(status) {
        let statusHtml = '';
        let statusClass = '';

        switch (status) {
            case 'connected':
                statusHtml = '<i class="fas fa-circle text-success"></i> Conectado';
                statusClass = 'text-success';
                break;
            case 'reconnecting':
                statusHtml = '<i class="fas fa-circle text-warning"></i> Reconectando...';
                statusClass = 'text-warning';
                break;
            case 'disconnected':
            case 'error':
                statusHtml = '<i class="fas fa-circle text-danger"></i> Desconectado';
                statusClass = 'text-danger';
                break;
            default:
                statusHtml = '<i class="fas fa-circle text-muted"></i> Conectando...';
                statusClass = 'text-muted';
        }

        const statusIndicator = $('#ws-status');
        if (statusIndicator.length) {
            statusIndicator.html(statusHtml).removeClass().addClass(statusClass);
        }
    }

    // ========================================================================
    // Enviar notificacion via API REST (sin /api/)
    // ========================================================================
    function sendNotification(group, action, data) {
        const url = NOTIFICATIONS_URL + '/send';

        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                group: group,
                messageCode: group,
                action: action,
                data: data
            })
        })
        .then(function(response) {
            if (!response.ok) {
                throw new Error('Error enviando notificacion: ' + response.status);
            }
            console.log('Notificacion enviada via API REST');
        })
        .catch(function(error) {
            console.error('Error enviando notificacion:', error);
        });
    }

    // ========================================================================
    // Utilidades
    // ========================================================================
    function showNotification(message, type) {
        type = type || 'info';
        const alertClass = {
            'info': 'alert-info',
            'success': 'alert-success',
            'warning': 'alert-warning',
            'error': 'alert-danger',
            'danger': 'alert-danger'
        }[type] || 'alert-info';

        const notification = $('<div class="alert ' + alertClass + ' alert-dismissible fade show position-fixed" role="alert" style="top: 20px; right: 20px; z-index: 9999;">')
            .html(message + '<button type="button" class="close" data-dismiss="alert"><span>&times;</span></button>');

        $('body').append(notification);

        setTimeout(function() {
            notification.alert('close');
        }, 3000);
    }

    function showError(message) {
        showNotification('<strong>Error:</strong> ' + message, 'danger');
    }

    // ========================================================================
    // Cleanup al cerrar
    // ========================================================================
    window.addEventListener('beforeunload', function() {
        if (hubConnection) {
            hubConnection.stop();
        }
    });

    // ========================================================================
    // Prevenir navegación no deseada dentro del iframe
    // ========================================================================
    function preventUnwantedNavigation() {
        // Interceptar clicks en links que podrían causar navegación
        $(document).on('click', 'a[href="#"], a[href=""], a:not([href])', function(e) {
            e.preventDefault();
            e.stopPropagation();
        });

        // Prevenir que el iframe navegue a la página principal
        window.addEventListener('beforeunload', function(e) {
            // Solo permitir si es un cierre legítimo de la ventana
            if (hubConnection) {
                hubConnection.stop();
            }
        });
    }

    // ========================================================================
    // Iniciar cuando el DOM este listo
    // ========================================================================
    $(document).ready(function() {
        preventUnwantedNavigation();
        init();
    });

})();
