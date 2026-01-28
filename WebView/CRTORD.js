/* ============================================================================
   JavaScript: Creación de Órdenes
   ============================================================================
   Lógica para crear órdenes y notificar via WebSocket (SignalR)
   ============================================================================ */

(function() {
    'use strict';

    // Variables globales
    let hubConnection = null;
    let especies = [];
    let clientes = [];
    let itemCount = 0;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 10;
    const RECONNECT_DELAY_MS = 3000;
    const COMISION_PORCENTAJE = 0.01; // 1% de comisión

    // ========================================================================
    // Inicialización
    // ========================================================================
    function init() {
        console.log('Inicializando WebView de Creación de Órdenes...');

        // Cargar datos iniciales
        loadClientes();
        loadEspecies();

        // Configurar event listeners
        setupEventListeners();

        // Agregar primer item vacío
        addItem();

        // Configurar conexión WebSocket
        setupWebSocketConnection();

        console.log('WebView inicializada correctamente');
    }

    // ========================================================================
    // Cargar clientes
    // ========================================================================
    function loadClientes() {
        bound.execPPL("GetClientes()").then(function(result) {
            clientes = transformData(result);
            const select = $('#clienteId');

            clientes.forEach(function(cliente) {
                select.append(
                    '<option value="' + cliente.Codigo + '">' +
                    cliente.Codigo + ' - ' + cliente.RazonSocial +
                    '</option>'
                );
            });
        }).catch(function(error) {
            console.error('Error cargando clientes:', error);
            showError('Error al cargar la lista de clientes');
        });
    }

    // ========================================================================
    // Cargar especies
    // ========================================================================
    function loadEspecies() {
        bound.execPPL("GetEspecies()").then(function(result) {
            especies = transformData(result);

            // Mostrar especies populares en el panel lateral
            const lista = $('#especies-populares');
            lista.empty();

            especies.slice(0, 5).forEach(function(especie) {
                const item = $('<li class="list-group-item d-flex justify-content-between align-items-center">' +
                    '<span>' + especie.Codigo + '</span>' +
                    '<small class="text-muted">' + especie.Descripcion.substring(0, 20) + '...</small>' +
                    '</li>');

                item.on('click', function() {
                    // Al hacer clic, agregar un item con esta especie
                    const lastItem = $('.item-row').last();
                    if (lastItem.length) {
                        lastItem.find('.especie-select').val(especie.EspecieId);
                    }
                });

                lista.append(item);
            });
        }).catch(function(error) {
            console.error('Error cargando especies:', error);
        });
    }

    // ========================================================================
    // Configurar event listeners
    // ========================================================================
    function setupEventListeners() {
        // Agregar item
        $('#btn-add-item').on('click', addItem);

        // Limpiar formulario
        $('#btn-limpiar').on('click', limpiarFormulario);

        // Crear orden
        $('#form-orden').on('submit', function(e) {
            e.preventDefault();
            crearOrden();
        });

        // Crear otra orden desde modal
        $('#btn-nueva-orden').on('click', function() {
            $('#modalConfirm').modal('hide');
            limpiarFormulario();
        });

        // Contador de caracteres en observaciones
        $('#observaciones').on('input', function() {
            $('#obs-count').text($(this).val().length);
        });
    }

    // ========================================================================
    // Agregar item al formulario
    // ========================================================================
    function addItem() {
        itemCount++;
        const itemHtml = `
            <div class="item-row new" data-item="${itemCount}">
                <span class="item-number">Item ${itemCount}</span>
                <button type="button" class="btn btn-sm btn-outline-danger btn-remove-item" onclick="removeItem(${itemCount})">
                    <i class="fas fa-times"></i>
                </button>
                <div class="form-row">
                    <div class="form-group col-md-5">
                        <label>Especie *</label>
                        <select class="form-control especie-select" name="especie_${itemCount}" required>
                            <option value="">Seleccione...</option>
                        </select>
                    </div>
                    <div class="form-group col-md-2">
                        <label>Cantidad *</label>
                        <input type="number" class="form-control cantidad-input" name="cantidad_${itemCount}"
                               min="1" step="1" required onchange="calcularTotales()">
                    </div>
                    <div class="form-group col-md-2">
                        <label>Precio *</label>
                        <input type="number" class="form-control precio-input" name="precio_${itemCount}"
                               min="0.01" step="0.01" required onchange="calcularTotales()">
                    </div>
                    <div class="form-group col-md-3">
                        <label>Importe</label>
                        <input type="text" class="form-control importe-display" readonly>
                    </div>
                </div>
            </div>
        `;

        $('#items-container').append(itemHtml);

        // Llenar el select de especies
        const newSelect = $(`[data-item="${itemCount}"] .especie-select`);
        especies.forEach(function(especie) {
            newSelect.append(
                '<option value="' + especie.EspecieId + '">' +
                especie.Codigo + ' - ' + especie.Descripcion +
                '</option>'
            );
        });

        // Quitar clase de animación después de completarla
        setTimeout(function() {
            $(`[data-item="${itemCount}"]`).removeClass('new');
        }, 300);
    }

    // Función global para eliminar item
    window.removeItem = function(itemNum) {
        const items = $('.item-row');
        if (items.length > 1) {
            $(`[data-item="${itemNum}"]`).remove();
            calcularTotales();
        } else {
            showNotification('Debe tener al menos un item', 'warning');
        }
    };

    // ========================================================================
    // Calcular totales
    // ========================================================================
    window.calcularTotales = function() {
        let subtotal = 0;
        let comisiones = 0;

        $('.item-row').each(function() {
            const cantidad = parseFloat($(this).find('.cantidad-input').val()) || 0;
            const precio = parseFloat($(this).find('.precio-input').val()) || 0;
            const importe = cantidad * precio;
            const comision = importe * COMISION_PORCENTAJE;

            $(this).find('.importe-display').val(formatMoney(importe));

            subtotal += importe;
            comisiones += comision;
        });

        $('#subtotal').text(formatMoney(subtotal));
        $('#total-comisiones').text(formatMoney(comisiones));
        $('#total-orden').html('<strong>' + formatMoney(subtotal + comisiones) + '</strong>');
    };

    // ========================================================================
    // Limpiar formulario
    // ========================================================================
    function limpiarFormulario() {
        $('#form-orden')[0].reset();
        $('#items-container').empty();
        itemCount = 0;
        addItem();
        calcularTotales();
        $('#obs-count').text('0');
    }

    // ========================================================================
    // Crear orden
    // ========================================================================
    function crearOrden() {
        // Validar formulario
        if (!validarFormulario()) {
            return;
        }

        $$.loading(true);
        $('#btn-crear').prop('disabled', true);

        // Recopilar datos de la orden
        const ordenData = {
            tipoOrden: $('#tipoOrden').val(),
            clienteId: $('#clienteId').val(),
            observaciones: $('#observaciones').val(),
            items: []
        };

        // Recopilar items
        $('.item-row').each(function() {
            const especieId = $(this).find('.especie-select').val();
            const cantidad = parseFloat($(this).find('.cantidad-input').val());
            const precio = parseFloat($(this).find('.precio-input').val());

            if (especieId && cantidad && precio) {
                ordenData.items.push({
                    especieId: parseInt(especieId),
                    cantidad: cantidad,
                    precio: precio,
                    importe: cantidad * precio,
                    comision: cantidad * precio * COMISION_PORCENTAJE
                });
            }
        });

        // Calcular monto total
        ordenData.monto = ordenData.items.reduce(function(sum, item) {
            return sum + item.importe + item.comision;
        }, 0);

        console.log('Creando orden:', ordenData);

        // Llamar a la función PPL para crear la orden
        bound.execPPL("CrearOrden(" + JSON.stringify(ordenData) + ")").then(function(result) {
            $$.loading(false);
            $('#btn-crear').prop('disabled', false);

            const nroOrden = result.NroOrden || result.nroOrden || result;

            console.log('Orden creada:', nroOrden);

            // Emitir mensaje ESTORD via WebSocket
            emitirNotificacionOrden('created', {
                NroOrden: nroOrden,
                TipoOrden: ordenData.tipoOrden,
                ClienteId: ordenData.clienteId,
                Monto: ordenData.monto,
                Estado: 'Pendiente'
            });

            // Mostrar modal de confirmación
            $('#orden-creada-nro').text(nroOrden);
            $('#modalConfirm').modal('show');

        }).catch(function(error) {
            $$.loading(false);
            $('#btn-crear').prop('disabled', false);
            console.error('Error creando orden:', error);
            showError('Error al crear la orden: ' + (error.message || error));
        });
    }

    // ========================================================================
    // Validar formulario
    // ========================================================================
    function validarFormulario() {
        let isValid = true;

        // Validar tipo de orden
        if (!$('#tipoOrden').val()) {
            $('#tipoOrden').addClass('is-invalid');
            isValid = false;
        } else {
            $('#tipoOrden').removeClass('is-invalid');
        }

        // Validar cliente
        if (!$('#clienteId').val()) {
            $('#clienteId').addClass('is-invalid');
            isValid = false;
        } else {
            $('#clienteId').removeClass('is-invalid');
        }

        // Validar que haya al menos un item completo
        let hasValidItem = false;
        $('.item-row').each(function() {
            const especie = $(this).find('.especie-select').val();
            const cantidad = $(this).find('.cantidad-input').val();
            const precio = $(this).find('.precio-input').val();

            if (especie && cantidad && precio) {
                hasValidItem = true;
            }
        });

        if (!hasValidItem) {
            showError('Debe agregar al menos un item completo');
            isValid = false;
        }

        return isValid;
    }

    // ========================================================================
    // Configurar conexión WebSocket con SignalR
    // ========================================================================
    function setupWebSocketConnection() {
        const apiBaseUrl = window.API_BASE_URL || 'http://localhost:56614';
        const hubUrl = apiBaseUrl + '/hubs/ppl';

        console.log('Conectando a WebSocket:', hubUrl);

        hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl, {
                transport: signalR.HttpTransportType.WebSockets,
                withCredentials: true
            })
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: function(retryContext) {
                    if (retryContext.previousRetryCount < MAX_RECONNECT_ATTEMPTS) {
                        return Math.min(RECONNECT_DELAY_MS * Math.pow(2, retryContext.previousRetryCount), 30000);
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
    // Configurar handlers del Hub
    // ========================================================================
    function setupHubEventHandlers() {
        hubConnection.onreconnecting(function(error) {
            console.warn('Reconectando...', error);
            updateConnectionStatus('reconnecting');
        });

        hubConnection.onreconnected(function(connectionId) {
            console.log('Reconectado:', connectionId);
            reconnectAttempts = 0;
            updateConnectionStatus('connected');
            showNotification('Conexión restablecida', 'success');
        });

        hubConnection.onclose(function(error) {
            console.error('Conexión cerrada:', error);
            updateConnectionStatus('disconnected');

            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                setTimeout(startConnection, RECONNECT_DELAY_MS * reconnectAttempts);
            }
        });
    }

    // ========================================================================
    // Iniciar conexión
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
            })
            .catch(function(error) {
                console.error('Error conectando:', error);
                updateConnectionStatus('error');

                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    setTimeout(startConnection, RECONNECT_DELAY_MS * reconnectAttempts);
                }
            });
    }

    // ========================================================================
    // Emitir notificación de orden via WebSocket
    // ========================================================================
    function emitirNotificacionOrden(action, orderData) {
        if (!hubConnection || hubConnection.state !== signalR.HubConnectionState.Connected) {
            console.warn('WebSocket no conectado, no se puede emitir notificación');
            return;
        }

        const payload = {
            action: action,
            timestamp: new Date().toISOString(),
            data: orderData
        };

        console.log('Emitiendo notificación ESTORD:', payload);

        // Usar BroadcastToAll para notificar a todos (incluido el creador)
        hubConnection.invoke('BroadcastToAll', 'ESTORD', payload)
            .then(function() {
                console.log('Notificación ESTORD emitida correctamente');
            })
            .catch(function(error) {
                console.error('Error emitiendo notificación:', error);
            });
    }

    // ========================================================================
    // Actualizar estado de conexión
    // ========================================================================
    function updateConnectionStatus(status) {
        let html = '';

        switch (status) {
            case 'connected':
                html = '<i class="fas fa-circle text-success"></i> Conectado';
                break;
            case 'reconnecting':
                html = '<i class="fas fa-circle text-warning"></i> Reconectando...';
                break;
            case 'disconnected':
            case 'error':
                html = '<i class="fas fa-circle text-danger"></i> Desconectado';
                break;
            default:
                html = '<i class="fas fa-circle text-muted"></i> Conectando...';
        }

        $('#ws-status').html(html);
    }

    // ========================================================================
    // Utilidades
    // ========================================================================
    function transformData(data) {
        if (!data) return [];
        if (data.result && Array.isArray(data.result)) {
            data = data.result;
        }
        if (!Array.isArray(data)) return [];

        return data.map(function(row) {
            if (Array.isArray(row)) {
                const obj = {};
                row.forEach(function(item) {
                    if (item && item.key !== undefined) {
                        const key = item.key.charAt(0).toUpperCase() + item.key.slice(1);
                        obj[key] = typeof item.value === 'string' ? item.value.trim() : item.value;
                    }
                });
                return obj;
            }
            return row;
        });
    }

    function formatMoney(value) {
        return '$' + value.toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

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
    // Cleanup
    // ========================================================================
    window.addEventListener('beforeunload', function() {
        if (hubConnection) {
            hubConnection.stop();
        }
    });

    // ========================================================================
    // Iniciar
    // ========================================================================
    $(document).ready(function() {
        init();
    });

})();
