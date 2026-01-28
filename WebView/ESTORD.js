/* ============================================================================
   JavaScript: Estado de Órdenes en Tiempo Real
   ============================================================================
   Lógica de interactividad, comunicación con backend PPL y actualizaciones
   en tiempo real via WebSocket (SignalR)
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

    // ========================================================================
    // Transformador de datos del backend
    // ========================================================================
    // El backend retorna arrays de objetos {key, value}, necesitamos convertirlos
    // a objetos planos {TipoOrden: "Compra", NroOrden: 1001, ...}
    function transformRow(row) {
        if (!row || !Array.isArray(row)) return row;

        const obj = {};
        row.forEach(function(item) {
            if (item && item.key !== undefined) {
                // Capitalizar la primera letra de cada palabra para mantener compatibilidad
                const key = capitalizeKey(item.key);
                // Trim de strings para quitar espacios en blanco extras
                obj[key] = typeof item.value === 'string' ? item.value.trim() : item.value;
            }
        });
        return obj;
    }

    function transformData(data) {
        if (!data) return [];

        // Si es un objeto con propiedad 'result', extraerla
        if (data.result && Array.isArray(data.result)) {
            data = data.result;
        }

        if (!Array.isArray(data)) return [];

        // Si el primer elemento es un array de {key, value}, transformar todo
        if (data.length > 0 && Array.isArray(data[0])) {
            return data.map(transformRow);
        }

        // Si ya es un array de objetos planos, solo hacer trim de strings
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

    // Capitaliza la primera letra de cada palabra (tipoorden -> TipoOrden)
    function capitalizeKey(key) {
        if (!key) return key;
        // Mapeo directo para claves conocidas
        const keyMap = {
            'tipoorden': 'TipoOrden',
            'nroorden': 'NroOrden',
            'fechaorden': 'FechaOrden',
            'cliente': 'Cliente',
            'estado': 'Estado',
            'monto': 'Monto',
            'usuario': 'Usuario',
            'nroitem': 'NroItem',
            'especie': 'Especie',
            'cantidad': 'Cantidad',
            'precio': 'Precio',
            'importe': 'Importe',
            'comision': 'Comision',
            'totalordenes': 'TotalOrdenes',
            'pendientes': 'Pendientes',
            'ejecutadas': 'Ejecutadas',
            'canceladas': 'Canceladas',
            'montototal': 'MontoTotal',
            'montopromedio': 'MontoPromedio'
        };

        const lowerKey = key.toLowerCase();
        if (keyMap[lowerKey]) {
            return keyMap[lowerKey];
        }

        // Fallback: capitalizar primera letra
        return key.charAt(0).toUpperCase() + key.slice(1);
    }

    // ========================================================================
    // Configuración de DataTable
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
            "data": "NroOrden",
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
                    if (data === 'Ejecutada') {
                        badgeClass = 'badge-ejecutada';
                    } else if (data === 'Cancelada') {
                        badgeClass = 'badge-cancelada';
                    }
                    return '<span class="badge badge-estado ' + badgeClass + '">' + data + '</span>';
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
            "data": "Usuario",
            "title": "Usuario"
        }
    ];

    // ========================================================================
    // Inicialización
    // ========================================================================
    function init() {
        console.log('Inicializando WebView de Órdenes...');

        // Obtener datos iniciales desde el Scope PPL
        loadInitialData();

        // Inicializar DataTable
        initDataTable();

        // Cargar estadísticas
        loadStatistics();

        // Configurar event listeners
        setupEventListeners();

        // Configurar actualización en tiempo real via WebSocket
        setupWebSocketConnection();

        console.log('WebView inicializada correctamente');
    }

    // ========================================================================
    // Cargar datos iniciales desde PPL
    // ========================================================================
    function loadInitialData() {
        bound.execPPL("GetOrdenes()").then(function(result) {
            ordenesData = transformData(result);
            console.log('Órdenes cargadas:', ordenesData.length);

            if (dataTable) {
                $$.setData(ordenesData, colsConfig);
            }
        }).catch(function(error) {
            console.error('Error cargando órdenes:', error);
            showError('Error al cargar las órdenes');
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
                zeroRecords: "No se encontraron órdenes",
                info: "Mostrando página _PAGE_ de _PAGES_",
                infoEmpty: "",
                infoFiltered: "(Filtrado de un total de _MAX_ registros)",
                search: "Buscar:",
                lengthMenu: "Mostrar _MENU_ registros",
                paginate: {
                    first: "Primera",
                    last: "Última",
                    next: "Siguiente >",
                    previous: "< Anterior"
                }
            },
            order: [[2, 'desc']], // Ordenar por NroOrden descendente
            rowCallback: function(row, data, index) {
                // Agregar atributo data para facilitar búsqueda
                $(row).attr('data-nro-orden', data.NroOrden);
            }
        });

        // Guardar referencia en librería $$
        $$.setDataTable(dataTable, dtSelector);

        // Definir claves para actualización
        $$.setKeyNames(["NroOrden"]);

        // Construir filtros automáticos
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
            filterTipo.append('<a class="dropdown-item" href="#" data-value="">Todos</a>');

            tipos.forEach(function(tipo) {
                const tipoOrden = tipo.TipoOrden || tipo.Tipoorden;
                const item = $('<a class="dropdown-item" href="#" data-value="' + tipoOrden + '">' + tipoOrden + '</a>');
                item.on('click', function(e) {
                    e.preventDefault();
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
            filterEstado.append('<a class="dropdown-item" href="#" data-value="">Todos</a>');

            estados.forEach(function(estado) {
                const estadoVal = estado.Estado;
                const item = $('<a class="dropdown-item" href="#" data-value="' + estadoVal + '">' + estadoVal + '</a>');
                item.on('click', function(e) {
                    e.preventDefault();
                    const value = $(this).data('value');
                    dataTable.column(5).search(value).draw();
                    $('#dropdownEstado').text(value || 'Todos los estados');
                });
                filterEstado.append(item);
            });
        });
    }

    // ========================================================================
    // Cargar estadísticas
    // ========================================================================
    function loadStatistics() {
        bound.execPPL("GetEstadisticas()").then(function(result) {
            // GetEstadisticas retorna un solo objeto (la primera fila)
            let stats = result;

            // Si viene como array de {key, value}, transformar
            if (Array.isArray(result) && result.length > 0) {
                if (Array.isArray(result[0])) {
                    // Es array de arrays (múltiples filas en formato key/value)
                    stats = transformRow(result[0]);
                } else if (result[0].key !== undefined) {
                    // Es un array de {key, value} directamente
                    stats = transformRow(result);
                } else {
                    // Ya es un objeto plano o array de objetos
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
            console.error('Error cargando estadísticas:', error);
        });
    }

    // ========================================================================
    // Configurar event listeners
    // ========================================================================
    function setupEventListeners() {
        // Botón de actualizar
        $('#btn-refresh').on('click', function() {
            refreshData();
        });

        // Click en fila para expandir detalle
        $('#dt1 tbody').on('click', 'td.details-control', function() {
            const tr = $(this).closest('tr');
            const row = dataTable.row(tr);

            if (row.child.isShown()) {
                // Cerrar detalle
                row.child.hide();
                tr.removeClass('shown');
            } else {
                // Abrir detalle
                const nroOrden = row.data().NroOrden;
                loadDetalleOrden(nroOrden, row, tr);
            }
        });

        // Doble click en fila para abrir modal
        $('#dt1 tbody').on('dblclick', 'tr', function() {
            const row = dataTable.row(this);
            const nroOrden = row.data().NroOrden;
            openModalDetalle(nroOrden);
        });
    }

    // ========================================================================
    // Cargar detalle de orden (expandible)
    // ========================================================================
    function loadDetalleOrden(nroOrden, row, tr) {
        $$.loading(true);

        bound.execPPL("GetDetalleOrden(" + nroOrden + ")").then(function(result) {
            $$.loading(false);

            const detalle = transformData(result);

            if (!detalle || detalle.length === 0) {
                row.child('<div class="p-3">No hay detalle disponible para esta orden</div>').show();
                tr.addClass('shown');
                return;
            }

            // Construir HTML del detalle
            let html = '<table class="table table-sm table-bordered mb-0">';
            html += '<thead><tr>';
            html += '<th>Item</th><th>Especie</th><th>Cantidad</th><th>Precio</th><th>Importe</th><th>Comisión</th>';
            html += '</tr></thead><tbody>';

            detalle.forEach(function(item) {
                html += '<tr>';
                html += '<td>' + item.NroItem + '</td>';
                html += '<td>' + item.Especie + '</td>';
                html += '<td>' + $$.numberFormat(item.Cantidad, 2, false, false) + '</td>';
                html += '<td>' + $$.numberFormat(item.Precio, 2, false, false) + '</td>';
                html += '<td>' + $$.numberFormat(item.Importe, 2, false, false) + '</td>';
                html += '<td>' + $$.numberFormat(item.Comision, 2, false, false) + '</td>';
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
    function openModalDetalle(nroOrden) {
        $('#modal-nro-orden').text(nroOrden);
        $('#modalDetalle').modal('show');

        bound.execPPL("GetDetalleOrden(" + nroOrden + ")").then(function(result) {
            const detalle = transformData(result);
            const tbody = $('#dt-detalle tbody');
            tbody.empty();

            if (!detalle || detalle.length === 0) {
                tbody.append('<tr><td colspan="6" class="text-center">No hay detalle disponible</td></tr>');
                return;
            }

            detalle.forEach(function(item) {
                const row = '<tr>' +
                    '<td>' + item.NroItem + '</td>' +
                    '<td>' + item.Especie + '</td>' +
                    '<td class="text-right">' + $$.numberFormat(item.Cantidad, 2, false, false) + '</td>' +
                    '<td class="text-right">' + $$.numberFormat(item.Precio, 2, false, false) + '</td>' +
                    '<td class="text-right">' + $$.numberFormat(item.Importe, 2, false, false) + '</td>' +
                    '<td class="text-right">' + $$.numberFormat(item.Comision, 2, false, false) + '</td>' +
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

            // Mostrar notificación
            showNotification('Datos actualizados correctamente');
        }).catch(function(error) {
            $$.loading(false);
            console.error('Error actualizando datos:', error);
            showError('Error al actualizar los datos');
        });
    }

    // ========================================================================
    // Configurar conexión WebSocket con SignalR
    // ========================================================================
    function setupWebSocketConnection() {
        // Obtener la URL base del API desde la configuración o usar default
        const apiBaseUrl = window.API_BASE_URL || 'http://localhost:56614';
        const hubUrl = apiBaseUrl + '/hubs/ppl';

        console.log('Conectando a WebSocket:', hubUrl);

        // Crear conexión SignalR
        hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl, {
                // Usar WebSockets como transporte preferido para mejor rendimiento
                transport: signalR.HttpTransportType.WebSockets,
                // Habilitar credentials para Windows Auth
                withCredentials: true
            })
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: function(retryContext) {
                    // Estrategia de reconexión exponencial con límite
                    if (retryContext.previousRetryCount < MAX_RECONNECT_ATTEMPTS) {
                        const delay = Math.min(
                            RECONNECT_DELAY_MS * Math.pow(2, retryContext.previousRetryCount),
                            30000 // Máximo 30 segundos
                        );
                        console.log('Reintentando conexión en ' + delay + 'ms...');
                        return delay;
                    }
                    // Dejar de reintentar después de MAX_RECONNECT_ATTEMPTS
                    return null;
                }
            })
            .configureLogging(signalR.LogLevel.Information)
            .build();

        // Configurar handlers de eventos
        setupHubEventHandlers();

        // Iniciar conexión
        startConnection();
    }

    // ========================================================================
    // Configurar handlers de eventos del Hub
    // ========================================================================
    function setupHubEventHandlers() {
        // Handler para recibir mensajes
        hubConnection.on('ReceiveMessage', function(messageCode, payload) {
            console.log('Mensaje recibido:', messageCode, payload);

            // Solo procesar mensajes ESTORD
            if (messageCode === 'ESTORD') {
                handleESTORDMessage(payload);
            }
        });

        // Handler de reconexión
        hubConnection.onreconnecting(function(error) {
            console.warn('Conexión perdida, reconectando...', error);
            updateConnectionStatus('reconnecting');
            showNotification('Reconectando al servidor...', 'warning');
        });

        // Handler de reconexión exitosa
        hubConnection.onreconnected(function(connectionId) {
            console.log('Reconectado al servidor con ID:', connectionId);
            reconnectAttempts = 0;
            updateConnectionStatus('connected');
            showNotification('Conexión restablecida', 'success');

            // Refrescar datos después de reconectar
            refreshData();
        });

        // Handler de desconexión
        hubConnection.onclose(function(error) {
            console.error('Conexión cerrada:', error);
            updateConnectionStatus('disconnected');

            // Intentar reconectar manualmente si no se pudo automáticamente
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                setTimeout(startConnection, RECONNECT_DELAY_MS * reconnectAttempts);
            } else {
                showError('No se pudo conectar al servidor. Por favor, recargue la página.');
            }
        });
    }

    // ========================================================================
    // Iniciar conexión WebSocket
    // ========================================================================
    function startConnection() {
        hubConnection.start()
            .then(function() {
                console.log('Conexión WebSocket establecida');
                reconnectAttempts = 0;
                updateConnectionStatus('connected');

                // Suscribirse al grupo ESTORD
                return hubConnection.invoke('Subscribe', 'ESTORD');
            })
            .then(function() {
                console.log('Suscrito al grupo ESTORD');
                showNotification('Conectado en tiempo real', 'success');
            })
            .catch(function(error) {
                console.error('Error conectando al WebSocket:', error);
                updateConnectionStatus('error');

                // Reintentar conexión
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
                showNotification('Nueva orden creada: #' + (orderData?.NroOrden || ''), 'info');
                refreshData();
                break;

            case 'updated':
                showNotification('Orden actualizada: #' + (orderData?.NroOrden || ''), 'info');
                if (orderData && orderData.NroOrden) {
                    // Actualizar solo la fila específica si es posible
                    updateSingleRow(orderData);
                } else {
                    refreshData();
                }
                break;

            case 'deleted':
                showNotification('Orden eliminada: #' + (orderData?.NroOrden || ''), 'warning');
                refreshData();
                break;

            default:
                // Acción desconocida, refrescar todo
                refreshData();
        }

        // Siempre actualizar estadísticas
        loadStatistics();
    }

    // ========================================================================
    // Actualizar una fila específica
    // ========================================================================
    function updateSingleRow(orderData) {
        if (!dataTable || !orderData || !orderData.NroOrden) {
            refreshData();
            return;
        }

        // Buscar la fila existente
        let rowFound = false;
        dataTable.rows().every(function() {
            const data = this.data();
            if (data && data.NroOrden === orderData.NroOrden) {
                // Actualizar los datos de la fila
                this.data(orderData).draw(false);
                rowFound = true;
                return false; // Salir del loop
            }
        });

        // Si no se encontró la fila, es una orden nueva - refrescar todo
        if (!rowFound) {
            refreshData();
        }
    }

    // ========================================================================
    // Actualizar indicador de estado de conexión
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

        // Actualizar indicador si existe
        const statusIndicator = $('#ws-status');
        if (statusIndicator.length) {
            statusIndicator.html(statusHtml).removeClass().addClass(statusClass);
        }
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

        // Crear toast o notificación simple
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
    // Iniciar cuando el DOM esté listo
    // ========================================================================
    $(document).ready(function() {
        init();
    });

})();
