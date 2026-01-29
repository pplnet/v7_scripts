/* ============================================================================
   JavaScript: Creacion de Ordenes
   ============================================================================
   Logica para crear ordenes y notificar via WebSocket (SignalR)
   Endpoint de notificaciones: https://localhost:44300/notifications
   ============================================================================ */

(function() {
    'use strict';

    // Variables globales
    let hubConnection = null;
    let especies = [];
    let clientes = [];
    let tiposOrden = [];
    let itemCount = 0;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 10;
    const RECONNECT_DELAY_MS = 3000;
    const COMISION_PORCENTAJE = 0.01; // 1% de comision

    // URL base del API - sin /api/ al inicio
    const API_BASE_URL = window.API_BASE_URL || 'https://localhost:44300';
    const NOTIFICATIONS_URL = API_BASE_URL + '/notifications';
    const HUB_URL = API_BASE_URL + '/hubs/ppl';

    // ========================================================================
    // Inicializacion
    // ========================================================================
    function init() {
        console.log('Inicializando WebView de Creacion de Ordenes...');
        console.log('API Base URL:', API_BASE_URL);
        console.log('Notifications URL:', NOTIFICATIONS_URL);
        console.log('Hub URL:', HUB_URL);

        // Configurar event listeners
        setupEventListeners();

        // Cargar datos iniciales (especies primero, luego agregar item)
        loadClientes();
        loadTiposOrden();
        loadEspecies().then(function() {
            // Agregar primer item vacio despues de cargar especies
            addItem();
        });

        // Configurar conexion WebSocket
        setupWebSocketConnection();

        console.log('WebView inicializada correctamente');
    }

    // ========================================================================
    // Cargar clientes - usa tabla CLIENTES real
    // ========================================================================
    function loadClientes() {
        bound.execPPL("GetClientes()").then(function(result) {
            clientes = transformData(result);
            const select = $('#clienteId');
            select.empty();
            select.append('<option value="">Seleccione cliente...</option>');

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
    // Cargar especies - usa tabla ESPECIES real
    // ========================================================================
    function loadEspecies() {
        return bound.execPPL("GetEspecies()").then(function(result) {
            especies = transformData(result);

            // Mostrar especies populares en el panel lateral
            const lista = $('#especies-populares');
            lista.empty();

            especies.slice(0, 5).forEach(function(especie) {
                const nombre = especie.Nombre || especie.Codigo;
                const item = $('<li class="list-group-item d-flex justify-content-between align-items-center">' +
                    '<span>' + especie.Codigo + '</span>' +
                    '<small class="text-muted">' + nombre.substring(0, 15) + '</small>' +
                    '</li>');

                item.on('click', function() {
                    const lastItem = $('.item-row').last();
                    if (lastItem.length) {
                        lastItem.find('.especie-select').val(especie.Codigo);
                        // Auto-llenar precio si tenemos VTeorico
                        if (especie.VTeorico) {
                            lastItem.find('.precio-input').val(especie.VTeorico);
                            calcularTotales();
                        }
                    }
                });

                lista.append(item);
            });

            console.log('Especies cargadas:', especies.length);
        }).catch(function(error) {
            console.error('Error cargando especies:', error);
        });
    }

    // ========================================================================
    // Cargar tipos de orden - usa tabla TIPOSORDEN real
    // ========================================================================
    function loadTiposOrden() {
        bound.execPPL("GetTiposOrdenDisponibles()").then(function(result) {
            tiposOrden = transformData(result);
            const select = $('#tipoOrden');
            select.empty();
            select.append('<option value="">Seleccione tipo...</option>');

            tiposOrden.forEach(function(tipo) {
                select.append(
                    '<option value="' + tipo.Codigo + '">' +
                    tipo.Nombre +
                    '</option>'
                );
            });
        }).catch(function(error) {
            console.error('Error cargando tipos de orden:', error);
            // Fallback a tipos fijos si falla
            const select = $('#tipoOrden');
            select.empty();
            select.append('<option value="">Seleccione tipo...</option>');
            select.append('<option value="COMPRA">Orden de Compra</option>');
            select.append('<option value="VENTA">Orden de Venta</option>');
        });
    }

    // ========================================================================
    // Configurar event listeners
    // ========================================================================
    function setupEventListeners() {
        $('#btn-add-item').on('click', addItem);
        $('#btn-limpiar').on('click', limpiarFormulario);

        $('#form-orden').on('submit', function(e) {
            e.preventDefault();
            crearOrden();
        });

        $('#btn-nueva-orden').on('click', function() {
            $('#modalConfirm').modal('hide');
            limpiarFormulario();
        });

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

        // Llenar el select de especies con codigo real
        const newSelect = $(`[data-item="${itemCount}"] .especie-select`);
        especies.forEach(function(especie) {
            const nombre = especie.Nombre || especie.Codigo;
            newSelect.append(
                '<option value="' + especie.Codigo + '" data-precio="' + (especie.VTeorico || 0) + '">' +
                especie.Codigo + ' - ' + nombre +
                '</option>'
            );
        });

        // Auto-llenar precio al seleccionar especie
        newSelect.on('change', function() {
            const selectedOption = $(this).find(':selected');
            const precio = selectedOption.data('precio');
            if (precio && precio > 0) {
                $(this).closest('.item-row').find('.precio-input').val(precio);
                calcularTotales();
            }
        });

        setTimeout(function() {
            $(`[data-item="${itemCount}"]`).removeClass('new');
        }, 300);
    }

    // Funcion global para eliminar item
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
    // Crear orden - usa parametros separados
    // ========================================================================
    function crearOrden() {
        if (!validarFormulario()) {
            return;
        }

        $$.loading(true);
        $('#btn-crear').prop('disabled', true);

        // Recopilar datos del formulario
        const tipoOrden = $('#tipoOrden').val();
        const clienteId = $('#clienteId').val();
        const observaciones = $('#observaciones').val() || '';

        // Obtener primer item (por ahora solo soportamos un item)
        const firstItem = $('.item-row').first();
        const especie = firstItem.find('.especie-select').val();
        const cantidad = parseFloat(firstItem.find('.cantidad-input').val());
        const precio = parseFloat(firstItem.find('.precio-input').val());

        // Calcular monto total para notificacion
        const importe = cantidad * precio;
        const monto = importe + (importe * COMISION_PORCENTAJE);

        console.log('Creando orden:', { tipoOrden, clienteId, especie, cantidad, precio, observaciones });

        // Escapar strings para PPL
        function escapeString(str) {
            return str.replace(/"/g, '""').replace(/'/g, "''");
        }

        // Llamar a la funcion PPL con parametros separados
        const pplCall = 'CrearOrden("' + escapeString(tipoOrden) + '", "' +
                        escapeString(clienteId) + '", "' +
                        escapeString(especie) + '", ' +
                        cantidad + ', ' +
                        precio + ', "' +
                        escapeString(observaciones) + '")';

        console.log('PPL Call:', pplCall);

        bound.execPPL(pplCall).then(function(result) {
            $$.loading(false);
            $('#btn-crear').prop('disabled', false);

            console.log('Resultado crudo:', result);
            console.log('Resultado JSON:', JSON.stringify(result, null, 2));

            // Extraer NrOrden del resultado (viene como array de {key, value})
            var nrOrden = '';
            if (Array.isArray(result)) {
                // Buscar el item con key 'nrorden' o 'NrOrden'
                var nrOrdenItem = result.find(function(item) {
                    return item.key && item.key.toLowerCase() === 'nrorden';
                });
                console.log('nrOrdenItem encontrado:', nrOrdenItem);
                if (nrOrdenItem) {
                    // El value puede ser: string, {val: string}, o anidado
                    var val = nrOrdenItem.value;
                    if (typeof val === 'string') {
                        nrOrden = val;
                    } else if (val && typeof val === 'object') {
                        // Puede ser {val: 'ORD00001'} o {value: 'ORD00001'}
                        nrOrden = val.val || val.value || val.Val || val.Value || JSON.stringify(val);
                    }
                }
            } else if (result && typeof result === 'object') {
                nrOrden = result.NrOrden || result.nrOrden || result.nrorden || result.val || '';
            } else if (typeof result === 'string') {
                nrOrden = result;
            }

            console.log('Orden creada:', nrOrden);

            // Emitir notificacion via WebSocket y API REST
            const notificationData = {
                NrOrden: nrOrden,
                TipoOrden: tipoOrden,
                Cliente: clienteId,
                Monto: monto,
                Estado: 'PEN',
                Especie: especie
            };

            emitirNotificacionOrden('created', notificationData);

            // Tambien enviar via API REST como backup
            sendNotificationViaREST('ESTORD', 'created', notificationData);

            // Mostrar modal de confirmacion
            $('#orden-creada-nro').text(nrOrden);
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

        if (!$('#tipoOrden').val()) {
            $('#tipoOrden').addClass('is-invalid');
            isValid = false;
        } else {
            $('#tipoOrden').removeClass('is-invalid');
        }

        if (!$('#clienteId').val()) {
            $('#clienteId').addClass('is-invalid');
            isValid = false;
        } else {
            $('#clienteId').removeClass('is-invalid');
        }

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
            showNotification('Conexion restablecida', 'success');
        });

        hubConnection.onclose(function(error) {
            console.error('Conexion cerrada:', error);
            updateConnectionStatus('disconnected');

            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                setTimeout(startConnection, RECONNECT_DELAY_MS * reconnectAttempts);
            }
        });
    }

    // ========================================================================
    // Iniciar conexion
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
    // Emitir notificacion de orden via WebSocket
    // ========================================================================
    function emitirNotificacionOrden(action, orderData) {
        if (!hubConnection || hubConnection.state !== signalR.HubConnectionState.Connected) {
            console.warn('WebSocket no conectado, usando API REST');
            return;
        }

        const payload = {
            action: action,
            timestamp: new Date().toISOString(),
            data: orderData
        };

        console.log('Emitiendo notificacion ESTORD via WebSocket:', payload);

        hubConnection.invoke('BroadcastToAll', 'ESTORD', payload)
            .then(function() {
                console.log('Notificacion ESTORD emitida correctamente via WebSocket');
            })
            .catch(function(error) {
                console.error('Error emitiendo notificacion via WebSocket:', error);
            });
    }

    // ========================================================================
    // Enviar notificacion via API REST (sin /api/)
    // ========================================================================
    function sendNotificationViaREST(group, action, data) {
        const url = NOTIFICATIONS_URL + '/send';

        console.log('Enviando notificacion via REST:', url);

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
            console.log('Notificacion enviada via API REST correctamente');
        })
        .catch(function(error) {
            console.error('Error enviando notificacion via REST:', error);
        });
    }

    // ========================================================================
    // Actualizar estado de conexion
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
            // Si ya es objeto plano, hacer trim de strings
            if (row && typeof row === 'object') {
                const obj = {};
                Object.keys(row).forEach(function(key) {
                    const newKey = key.charAt(0).toUpperCase() + key.slice(1);
                    obj[newKey] = typeof row[key] === 'string' ? row[key].trim() : row[key];
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
