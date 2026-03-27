/* ============================================================================
   JavaScript: Compra de Titulos (V2)
   ============================================================================
   Logica para ingreso de ordenes de compra y notificacion via WebSocket
   ============================================================================ */

(function() {
    'use strict';

    var hubConnection = null;
    var especies = [];
    var clientes = [];
    var currentUser = '';
    var itemCount = 0;
    var reconnectAttempts = 0;
    var MAX_RECONNECT_ATTEMPTS = 10;
    var RECONNECT_DELAY_MS = 3000;

    var ARANCEL_PCT = 0.005;
    var DER_BOLSA_PCT = 0.001;
    var DER_MERCADO_PCT = 0.0005;

    var API_BASE_URL = window.API_BASE_URL || 'https://localhost:44300';
    var NOTIFICATIONS_URL = API_BASE_URL + '/notifications';
    var HUB_URL = API_BASE_URL + '/hubs/ppl';

    // ========================================================================
    // Key mapping - fixes the capitalization issue
    // ========================================================================
    var keyMap = {
        'codigo': 'Codigo',
        'razonsocial': 'RazonSocial',
        'nrcuenta': 'NrCuenta',
        'nombre': 'Nombre',
        'extendido': 'Extendido',
        'tipo': 'Tipo',
        'moneda': 'Moneda',
        'vteorico': 'VTeorico',
        'vnominal': 'VNominal',
        'nrorden': 'NrOrden',
        'importe': 'Importe',
        'aranceles': 'Aranceles',
        'derechobolsa': 'DerechoBolsa',
        'derechomercado': 'DerechoMercado',
        'success': 'Success'
    };

    function capitalizeKey(key) {
        if (!key) return key;
        var lower = key.toLowerCase();
        return keyMap[lower] || (key.charAt(0).toUpperCase() + key.slice(1));
    }

    function transformData(data) {
        if (!data) return [];
        if (data.result && Array.isArray(data.result)) data = data.result;
        if (!Array.isArray(data)) return [];

        return data.map(function(row) {
            if (Array.isArray(row)) {
                var obj = {};
                row.forEach(function(item) {
                    if (item && item.key !== undefined) {
                        obj[capitalizeKey(item.key)] = typeof item.value === 'string' ? item.value.trim() : item.value;
                    }
                });
                return obj;
            }
            if (row && typeof row === 'object') {
                var obj2 = {};
                Object.keys(row).forEach(function(k) {
                    obj2[capitalizeKey(k)] = typeof row[k] === 'string' ? row[k].trim() : row[k];
                });
                return obj2;
            }
            return row;
        });
    }

    // ========================================================================
    // Init
    // ========================================================================
    function init() {
        console.log('CRTOR2: Inicializando...');
        setupEventListeners();
        loadCurrentUser();
        loadClientes();
        loadEspecies().then(function() { addItem(); });
        setupWebSocketConnection();
    }

    // ========================================================================
    // Load current user from session (UsuarioActivo)
    // ========================================================================
    function loadCurrentUser() {
        bound.execPPL("UsuarioActivo()").then(function(result) {
            currentUser = (typeof result === 'string') ? result.trim() : '';
            console.log('CRTOR2: Usuario activo:', currentUser);
        }).catch(function(err) {
            console.error('Error obteniendo usuario:', err);
            currentUser = '';
        });
    }

    // ========================================================================
    // Load clients - with proper key mapping
    // ========================================================================
    function loadClientes() {
        bound.execPPL("GetClientes()").then(function(result) {
            clientes = transformData(result);
            var select = $('#clienteId');
            select.empty();
            select.append('<option value="">Seleccione un cliente...</option>');

            clientes.forEach(function(c) {
                var nombre = c.RazonSocial || '';
                var cuenta = c.NrCuenta ? ' [' + c.NrCuenta + ']' : '';
                select.append(
                    '<option value="' + c.Codigo + '">' +
                    c.Codigo + ' - ' + nombre + cuenta +
                    '</option>'
                );
            });

            console.log('CRTOR2: Clientes cargados:', clientes.length);
        }).catch(function(err) {
            console.error('Error cargando clientes:', err);
            showToast('Error al cargar clientes', 'error');
        });
    }

    // ========================================================================
    // Load species
    // ========================================================================
    function loadEspecies() {
        return bound.execPPL("GetEspecies()").then(function(result) {
            especies = transformData(result);

            var lista = $('#especies-populares');
            lista.empty();

            especies.slice(0, 8).forEach(function(esp) {
                var nombre = esp.Nombre || esp.Codigo;
                var precio = esp.VTeorico || 0;
                var li = $(
                    '<li>' +
                    '<span class="ref-code">' + esp.Codigo + '</span>' +
                    '<span class="ref-price">' + (precio > 0 ? formatMoney(precio) : '-') + '</span>' +
                    '</li>'
                );

                li.on('click', function() {
                    var lastItem = $('.crtor2-item').last();
                    if (lastItem.length) {
                        lastItem.find('.especie-select').val(esp.Codigo);
                        if (precio > 0) {
                            lastItem.find('.precio-input').val(precio);
                            calcularTotales();
                        }
                    }
                });

                lista.append(li);
            });

            console.log('CRTOR2: Especies cargadas:', especies.length);
        }).catch(function(err) {
            console.error('Error cargando especies:', err);
        });
    }

    // ========================================================================
    // Event listeners
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
    // Add item row
    // ========================================================================
    function addItem() {
        itemCount++;
        var html =
            '<div class="crtor2-item new" data-item="' + itemCount + '">' +
            '<span class="crtor2-item-number">' + itemCount + '</span>' +
            '<button type="button" class="crtor2-btn-remove" onclick="removeItem(' + itemCount + ')">&times;</button>' +
            '<div class="form-row">' +
            '  <div class="form-group col-md-5">' +
            '    <label>ESPECIE</label>' +
            '    <select class="form-control especie-select" required>' +
            '      <option value="">Seleccione...</option>' +
            '    </select>' +
            '  </div>' +
            '  <div class="form-group col-md-2">' +
            '    <label>CANTIDAD</label>' +
            '    <input type="number" class="form-control cantidad-input" min="1" step="1" required onchange="calcularTotales()">' +
            '  </div>' +
            '  <div class="form-group col-md-2">' +
            '    <label>PRECIO</label>' +
            '    <input type="number" class="form-control precio-input" min="0.01" step="0.01" required onchange="calcularTotales()">' +
            '  </div>' +
            '  <div class="form-group col-md-3">' +
            '    <label>IMPORTE</label>' +
            '    <input type="text" class="form-control importe-display" readonly tabindex="-1">' +
            '  </div>' +
            '</div>' +
            '</div>';

        $('#items-container').append(html);

        var newSelect = $('[data-item="' + itemCount + '"] .especie-select');
        especies.forEach(function(esp) {
            var nombre = esp.Nombre || esp.Codigo;
            newSelect.append(
                '<option value="' + esp.Codigo + '" data-precio="' + (esp.VTeorico || 0) + '">' +
                esp.Codigo + ' - ' + nombre +
                '</option>'
            );
        });

        newSelect.on('change', function() {
            var precio = $(this).find(':selected').data('precio');
            if (precio && precio > 0) {
                $(this).closest('.crtor2-item').find('.precio-input').val(precio);
                calcularTotales();
            }
        });

        setTimeout(function() {
            $('[data-item="' + itemCount + '"]').removeClass('new');
        }, 200);
    }

    window.removeItem = function(n) {
        if ($('.crtor2-item').length > 1) {
            $('[data-item="' + n + '"]').remove();
            calcularTotales();
        } else {
            showToast('Debe tener al menos una línea', 'error');
        }
    };

    // ========================================================================
    // Calculate totals
    // ========================================================================
    window.calcularTotales = function() {
        var subtotal = 0;

        $('.crtor2-item').each(function() {
            var cantidad = parseFloat($(this).find('.cantidad-input').val()) || 0;
            var precio = parseFloat($(this).find('.precio-input').val()) || 0;
            var importe = cantidad * precio;
            $(this).find('.importe-display').val(importe > 0 ? formatMoney(importe) : '');
            subtotal += importe;
        });

        var aranceles = subtotal * ARANCEL_PCT;
        var derBolsa = subtotal * DER_BOLSA_PCT;
        var derMercado = subtotal * DER_MERCADO_PCT;
        var total = subtotal + aranceles + derBolsa + derMercado;

        $('#subtotal').text(formatMoney(subtotal));
        $('#total-aranceles').text(formatMoney(aranceles));
        $('#total-der-bolsa').text(formatMoney(derBolsa));
        $('#total-der-mercado').text(formatMoney(derMercado));
        $('#total-orden').html('<strong>' + formatMoney(total) + '</strong>');
    };

    // ========================================================================
    // Clear form
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
    // Create order - processes ALL items sequentially
    // ========================================================================
    function crearOrden() {
        if (!validarFormulario()) return;

        $$.loading(true);
        $('#btn-crear').prop('disabled', true);

        var clienteId = $('#clienteId').val();
        var mercado = $('#mercado').val();
        var observaciones = $('#observaciones').val() || '';

        function esc(s) { return s.replace(/"/g, '""').replace(/'/g, "''"); }

        // Collect all valid items
        var items = [];
        $('.crtor2-item').each(function() {
            var especie = $(this).find('.especie-select').val();
            var cantidad = parseFloat($(this).find('.cantidad-input').val());
            var precio = parseFloat($(this).find('.precio-input').val());
            if (especie && cantidad > 0 && precio > 0) {
                items.push({ especie: especie, cantidad: cantidad, precio: precio });
            }
        });

        if (items.length === 0) {
            $$.loading(false);
            $('#btn-crear').prop('disabled', false);
            showToast('No hay ítems válidos para crear', 'error');
            return;
        }

        console.log('CRTOR2: Creando', items.length, 'orden(es)');

        // Process items sequentially - one ORDENES row per item
        var createdOrders = [];
        var totalMonto = 0;

        function processItem(index) {
            if (index >= items.length) {
                // All items processed
                $$.loading(false);
                $('#btn-crear').prop('disabled', false);

                var nroList = createdOrders.join(', ');
                console.log('Ordenes creadas:', nroList);

                // Notify ESTOR2 once with all orders
                var notificationData = {
                    NrOrden: createdOrders[0],
                    Ordenes: createdOrders,
                    TipoOrden: 'COMPRA',
                    Cliente: clienteId,
                    Monto: totalMonto,
                    Estado: 'PEN',
                    CantidadOrdenes: createdOrders.length
                };

                emitirNotificacion('created', notificationData);
                sendNotificationREST('ESTOR2', 'created', notificationData);

                $('#orden-creada-nro').text(nroList);
                $('#modalConfirm').modal('show');
                return;
            }

            var item = items[index];
            var pplCall = 'CrearOrdenCompra("' + esc(clienteId) + '", "' +
                          esc(item.especie) + '", ' +
                          item.cantidad + ', ' +
                          item.precio + ', "' +
                          esc(mercado) + '", "' +
                          esc(currentUser) + '", "' +
                          esc(observaciones) + '")';

            console.log('CRTOR2 PPL Call [' + (index + 1) + '/' + items.length + ']:', pplCall);

            bound.execPPL(pplCall).then(function(result) {
                var nrOrden = extractNrOrden(result);
                createdOrders.push(nrOrden);

                var importe = item.cantidad * item.precio;
                totalMonto += importe + (importe * (ARANCEL_PCT + DER_BOLSA_PCT + DER_MERCADO_PCT));

                // Process next item
                processItem(index + 1);
            }).catch(function(err) {
                $$.loading(false);
                $('#btn-crear').prop('disabled', false);
                console.error('Error creando orden item ' + (index + 1) + ':', err);
                if (createdOrders.length > 0) {
                    showToast('Se crearon ' + createdOrders.length + ' de ' + items.length + ' órdenes. Error: ' + (err.message || err), 'error');
                    $('#orden-creada-nro').text(createdOrders.join(', '));
                    $('#modalConfirm').modal('show');
                } else {
                    showToast('Error al crear la orden: ' + (err.message || err), 'error');
                }
            });
        }

        processItem(0);
    }

    function extractNrOrden(result) {
        var nrOrden = '';
        if (Array.isArray(result)) {
            var item = result.find(function(r) {
                return r.key && r.key.toLowerCase() === 'nrorden';
            });
            if (item) {
                var val = item.value;
                if (typeof val === 'string') nrOrden = val;
                else if (val && typeof val === 'object') nrOrden = val.val || val.value || val.Val || val.Value || '';
            }
        } else if (result && typeof result === 'object') {
            nrOrden = result.NrOrden || result.nrOrden || result.nrorden || '';
        } else if (typeof result === 'string') {
            nrOrden = result;
        }
        return nrOrden;
    }

    // ========================================================================
    // Validate
    // ========================================================================
    function validarFormulario() {
        var valid = true;

        if (!$('#clienteId').val()) {
            $('#clienteId').addClass('is-invalid');
            valid = false;
        } else {
            $('#clienteId').removeClass('is-invalid');
        }

        var hasItem = false;
        $('.crtor2-item').each(function() {
            var e = $(this).find('.especie-select').val();
            var c = $(this).find('.cantidad-input').val();
            var p = $(this).find('.precio-input').val();
            if (e && c && p) hasItem = true;
        });

        if (!hasItem) {
            showToast('Complete al menos una línea de compra', 'error');
            valid = false;
        }

        return valid;
    }

    // ========================================================================
    // WebSocket
    // ========================================================================
    function setupWebSocketConnection() {
        console.log('CRTOR2: Conectando WS:', HUB_URL);

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

        hubConnection.onreconnecting(function() { updateWsStatus('reconnecting'); });
        hubConnection.onreconnected(function() { reconnectAttempts = 0; updateWsStatus('connected'); });
        hubConnection.onclose(function() {
            updateWsStatus('disconnected');
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                setTimeout(startConnection, RECONNECT_DELAY_MS * reconnectAttempts);
            }
        });

        startConnection();
    }

    function startConnection() {
        hubConnection.start()
            .then(function() {
                reconnectAttempts = 0;
                updateWsStatus('connected');
                return hubConnection.invoke('Subscribe', 'ESTOR2');
            })
            .then(function() { console.log('CRTOR2: Suscrito a ESTOR2'); })
            .catch(function(err) {
                console.error('Error WS:', err);
                updateWsStatus('error');
                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    setTimeout(startConnection, RECONNECT_DELAY_MS * reconnectAttempts);
                }
            });
    }

    function emitirNotificacion(action, data) {
        if (!hubConnection || hubConnection.state !== signalR.HubConnectionState.Connected) return;

        var payload = { action: action, timestamp: new Date().toISOString(), data: data };
        hubConnection.invoke('BroadcastToAll', 'ESTOR2', payload)
            .then(function() { console.log('CRTOR2: Notificacion WS enviada'); })
            .catch(function(err) { console.error('Error WS notification:', err); });
    }

    function sendNotificationREST(group, action, data) {
        fetch(NOTIFICATIONS_URL + '/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ group: group, messageCode: group, action: action, data: data })
        }).catch(function(err) { console.error('Error REST notification:', err); });
    }

    // ========================================================================
    // UI helpers
    // ========================================================================
    function updateWsStatus(status) {
        var dot = $('.crtor2-ws-dot');
        var el = $('#ws-status');
        dot.removeClass('connected error');

        switch (status) {
            case 'connected':
                dot.addClass('connected');
                el.html('<span class="crtor2-ws-dot connected"></span> Conectado');
                break;
            case 'reconnecting':
                el.html('<span class="crtor2-ws-dot"></span> Reconectando...');
                break;
            case 'disconnected':
            case 'error':
                dot.addClass('error');
                el.html('<span class="crtor2-ws-dot error"></span> Desconectado');
                break;
            default:
                el.html('<span class="crtor2-ws-dot"></span> Conectando...');
        }
    }

    function formatMoney(value) {
        return '$ ' + value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function showToast(message, type) {
        type = type || 'info';
        var toast = $('<div class="crtor2-toast ' + type + '">' + message + '</div>');
        $('body').append(toast);
        setTimeout(function() { toast.fadeOut(300, function() { toast.remove(); }); }, 3000);
    }

    // ========================================================================
    // Cleanup
    // ========================================================================
    window.addEventListener('beforeunload', function() {
        if (hubConnection) hubConnection.stop();
    });

    $(document).ready(function() { init(); });

})();
