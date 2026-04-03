/* ============================================================================
   JavaScript: Venta de Titulos - Operacion (1:1 replica del dialogo)
   ============================================================================
   Formulario completo para carga de operaciones de venta de titulos
   con notificacion en tiempo real al monitor POSI4 via WebSocket.
   TipoOp = 'TIV' / 'VENTA'
   Sin validaciones - solo inputs, labels, calculos y mapeo a DB.
   ============================================================================ */

(function() {
    'use strict';

    var hubConnection = null;
    var reconnectAttempts = 0;
    var MAX_RECONNECT_ATTEMPTS = 10;
    var RECONNECT_DELAY_MS = 3000;

    var API_BASE_URL = window.API_BASE_URL || 'https://localhost:44300';
    var HUB_URL = API_BASE_URL + '/hubs/ppl';
    var NOTIFICATIONS_URL = API_BASE_URL + '/notifications';

    // ========================================================================
    // Key mapping - fixes capitalization from PPL results
    // ========================================================================
    var keyMap = {
        'codigo': 'Codigo', 'razonsocial': 'RazonSocial', 'nrcuenta': 'NrCuenta',
        'nombre': 'Nombre', 'extendido': 'Extendido', 'descripcion': 'Descripcion',
        'tipo': 'Tipo', 'moneda': 'Moneda', 'monedaemision': 'MonedaEmision',
        'vteorico': 'VTeorico', 'vnominal': 'VNominal',
        'nroperacion': 'NrOperacion', 'importe': 'Importe', 'success': 'Success',
        'esnegociacion': 'EsNegociacion', 'esliquidacion': 'EsLiquidacion',
        'cotizaen': 'CotizaEn', 'codmaecontado': 'CodMAEContado',
        'habilitada': 'Habilitada', 'plazoliq': 'PlazoLiq',
        'interesesc': 'InteresesC', 'cotizamae': 'CotizaMAE'
    };

    function capitalizeKey(key) {
        if (!key) return key;
        var lower = key.toLowerCase();
        return keyMap[lower] || (key.charAt(0).toUpperCase() + key.slice(1));
    }

    function unwrapVal(v) {
        if (v === null || v === undefined) return '';
        if (typeof v === 'string') return v.trim();
        if (typeof v === 'number') return v;
        if (typeof v === 'object') {
            if (v.val !== undefined) return unwrapVal(v.val);
            if (v.value !== undefined) return unwrapVal(v.value);
            if (v.Val !== undefined) return unwrapVal(v.Val);
            if (v.Value !== undefined) return unwrapVal(v.Value);
        }
        return String(v);
    }

    function transformData(data) {
        if (!data) return [];
        if (data.result && Array.isArray(data.result)) data = data.result;
        if (!Array.isArray(data)) return [];
        return data.map(function(row) {
            if (Array.isArray(row)) {
                var obj = {};
                row.forEach(function(item) {
                    if (item && item.key !== undefined)
                        obj[capitalizeKey(item.key)] = unwrapVal(item.value);
                });
                return obj;
            }
            if (row && typeof row === 'object') {
                var obj2 = {};
                Object.keys(row).forEach(function(k) {
                    obj2[capitalizeKey(k)] = unwrapVal(row[k]);
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
        console.log('TIV: Inicializando...');
        var today = new Date().toISOString().split('T')[0];
        $('#fechaOp').val(today);
        $('#fechaVto').val(today);
        $('#fechaPago').val(today);

        setupEventListeners();
        loadClientes();
        loadEspecies();
        loadContraEspecies();
        loadVehiculos();
        loadMercados();
        loadBooks();
        loadCorredores();
        loadOperador();
        setupWebSocketConnection();
    }

    // ========================================================================
    // Load combos from PPL backend
    // ========================================================================
    function loadClientes() {
        bound.execPPL("GetClientes()").then(function(result) {
            var data = transformData(result);
            var sel = $('#clienteId');
            data.forEach(function(c) {
                sel.append('<option value="' + c.Codigo + '">' + c.Codigo + ' - ' + (c.RazonSocial || '') + '</option>');
            });
            console.log('TIV: Clientes cargados:', data.length);
        }).catch(function(err) { console.error('Error cargando clientes:', err); });
    }

    function loadEspecies() {
        bound.execPPL("GetEspecies()").then(function(result) {
            var data = transformData(result);
            var sel = $('#especie');
            data.forEach(function(e) {
                sel.append('<option value="' + e.Codigo + '">' + e.Codigo + ' - ' + (e.Nombre || '') + '</option>');
            });
            console.log('TIV: Especies cargadas:', data.length);
        }).catch(function(err) { console.error('Error cargando especies:', err); });
    }

    function loadContraEspecies() {
        bound.execPPL("GetContraEspecies()").then(function(result) {
            var data = transformData(result);
            var sel = $('#contraespecie');
            data.forEach(function(e) {
                sel.append('<option value="' + e.Codigo + '">' + e.Codigo + ' - ' + (e.Nombre || '') + '</option>');
            });
        }).catch(function(err) { console.error('Error cargando contraespecies:', err); });
    }

    function loadVehiculos() {
        bound.execPPL("GetVehiculos()").then(function(result) {
            var data = transformData(result);
            var sel = $('#vehiculo1');
            data.forEach(function(v) {
                sel.append('<option value="' + v.Codigo + '">' + v.Codigo + ' - ' + (v.Descripcion || '') + '</option>');
            });
        }).catch(function(err) { console.error('Error cargando vehiculos:', err); });
    }

    function loadMercados() {
        bound.execPPL("GetMercados()").then(function(result) {
            var data = transformData(result);
            ['#mercado4', '#mercado', '#mercado2'].forEach(function(selId) {
                var sel = $(selId);
                data.forEach(function(m) {
                    sel.append('<option value="' + m.Codigo + '">' + m.Codigo + ' - ' + (m.Descripcion || '') + '</option>');
                });
            });
        }).catch(function(err) { console.error('Error cargando mercados:', err); });
    }

    function loadBooks() {
        bound.execPPL("GetBooks()").then(function(result) {
            var data = transformData(result);
            var sel = $('#book1');
            data.forEach(function(b) {
                sel.append('<option value="' + b.Codigo + '">' + b.Codigo + '</option>');
            });
        }).catch(function(err) { console.error('Error cargando books:', err); });
    }

    function loadCorredores() {
        bound.execPPL("GetCorredores()").then(function(result) {
            var data = transformData(result);
            var sel = $('#corredor');
            data.forEach(function(c) {
                sel.append('<option value="' + c.Codigo + '">' + c.Codigo + ' - ' + (c.Nombre || c.Descripcion || '') + '</option>');
            });
        }).catch(function(err) { console.error('Error cargando corredores:', err); });
    }

    function loadOperador() {
        bound.execPPL("GetOperador()").then(function(result) {
            var val = '';
            if (typeof result === 'string') val = result.trim();
            else if (result && result.result) val = unwrapVal(result.result);
            else if (Array.isArray(result) && result.length > 0) {
                var item = result[0];
                val = (item && item.value) ? unwrapVal(item.value) : '';
            } else {
                val = unwrapVal(result);
            }
            $('#operador').val(val);
        }).catch(function(err) { console.error('Error cargando operador:', err); });
    }

    // ========================================================================
    // Event listeners
    // ========================================================================
    function setupEventListeners() {
        // Recalculate on field changes
        $('#cantidad, #precio, #tipoCambio, #totalAux8').on('input', recalcular);
        $('input[name="rb5"]').on('change', onPlazoChange);
        $('#especie').on('change', onEspecieChange);

        // Buttons
        $('#btn-limpiar').on('click', limpiarFormulario);
        $('#btn-nueva-op').on('click', function() {
            $('#modalConfirm').modal('hide');
            limpiarFormulario();
        });
        $('#form-op').on('submit', function(e) {
            e.preventDefault();
            crearOperacion();
        });
    }

    // ========================================================================
    // Plazo radio change -> recalc fechaVto
    // ========================================================================
    function onPlazoChange() {
        var rb5 = parseInt($('input[name="rb5"]:checked').val()) || 0;
        var plazoHoras = rb5 === 0 ? 0 : rb5 * 24;
        $('#plazo').val(plazoHoras);

        // Simple approximation: add business days based on plazo
        var fechaOp = $('#fechaOp').val();
        if (fechaOp) {
            var d = new Date(fechaOp + 'T12:00:00');
            var daysToAdd = rb5;
            var added = 0;
            while (added < daysToAdd) {
                d.setDate(d.getDate() + 1);
                var dow = d.getDay();
                if (dow !== 0 && dow !== 6) added++;
            }
            var iso = d.toISOString().split('T')[0];
            $('#fechaVto').val(iso);
            $('#fechaPago').val(iso);
        }
        recalcular();
    }

    // ========================================================================
    // Especie change
    // ========================================================================
    function onEspecieChange() {
        // Could load especie-specific defaults here via PPL
        recalcular();
    }

    // ========================================================================
    // Recalculate computed fields
    // ========================================================================
    function recalcular() {
        var cantidad = parseFloat($('#cantidad').val()) || 0;
        var precio = parseFloat($('#precio').val()) || 0;

        // TotalBrutoCli1 = Precio * Cantidad (simplified, in original: may include ValorTeorico)
        var totalBruto = precio * cantidad;
        $('#totalBrutoCli1').val(totalBruto > 0 ? formatMoney(totalBruto) : '');

        // VCAN33 (Neto s/Com) = TotalBruto (simplified - in original includes intereses capitalizados)
        var vcan33 = totalBruto;
        $('#vcan33').val(vcan33 > 0 ? formatMoney(vcan33) : '');

        // TotalIntereses = 0 (simplified)
        var totalIntereses = 0;
        $('#totalIntereses').val(totalIntereses !== 0 ? formatMoney(totalIntereses) : '');
        $('#vcan22').val(totalIntereses);

        // TotalNetoCli1 = VCAN33 + (comisiones * -1 for VENTA)
        // For TIV: TotalNetoCli1 = VCAN33 + ((TotalAux2 + TotalIva + TotalGastos + TotalIvaAdi) * (-1))
        var totalAux2 = 0;
        var totalIva = 0;
        var totalGastos = 0;
        var totalIvaAdi = 0;
        // These would normally be computed by PPL; show as zero for now
        $('#totalAux2').val(totalAux2 !== 0 ? formatMoney(totalAux2) : '');
        $('#totalIva').val(totalIva !== 0 ? formatMoney(totalIva) : '');
        $('#totalGastos').val(totalGastos !== 0 ? formatMoney(totalGastos) : '');
        $('#totalIvaAdi').val(totalIvaAdi !== 0 ? formatMoney(totalIvaAdi) : '');

        var totalNeto = vcan33 + ((totalAux2 + totalIva + totalGastos + totalIvaAdi) * (-1));
        $('#totalNetoCli1').val(totalNeto > 0 ? formatMoney(totalNeto) : '');

        // Tasa (TipoCambio) - display only, user can edit for zero-coupon
        // TipoCambio = (1 - Precio) * 36000 / (FechaMaduracion - FechaVto) -- not computed here
    }

    // ========================================================================
    // Clear form
    // ========================================================================
    function limpiarFormulario() {
        $('#form-op')[0].reset();
        var today = new Date().toISOString().split('T')[0];
        $('#fechaOp').val(today);
        $('#fechaVto').val(today);
        $('#fechaPago').val(today);
        $('input[name="rb5"][value="0"]').prop('checked', true);
        $('input[name="formaLiq1"][value="0"]').prop('checked', true);
        $('input[name="formaLiq2"][value="1"]').prop('checked', true);
        $('input[name="rb9"][value="-1"]').prop('checked', true);
        $('#tipoOp').val('TIV');
        $('#plazo').val('0');

        // Clear calculated fields
        $('#totalBrutoCli1, #vcan33, #totalIntereses, #totalNetoCli1').val('');
        $('#totalAux2, #totalIva, #totalGastos, #totalIvaAdi, #totalComisiones').val('');
        $('#saldoTeorico, #saldoCtaTit, #montoUsd, #montoPresset').text('-');

        loadOperador();
    }

    // ========================================================================
    // Create operation - builds full INSERT via PPL
    // ========================================================================
    function crearOperacion() {
        $$.loading(true);
        $('#btn-crear').prop('disabled', true);

        function esc(s) { return String(s == null ? '' : s).replace(/"/g, '""').replace(/'/g, "''"); }

        var params = {
            fechaOp:       $('#fechaOp').val(),
            fechaVto:      $('#fechaVto').val(),
            fechaPago:     $('#fechaPago').val(),
            cliente:       $('#clienteId').val(),
            especie:       $('#especie').val(),
            contraespecie: $('#contraespecie').val() || '',
            cantidad:      parseFloat($('#cantidad').val()) || 0,
            precio:        parseFloat($('#precio').val()) || 0,
            corredor:      $('#corredor').val() || '',
            mercado4:      $('#mercado4').val() || '',
            plataforma:    $('#plataforma').val() || '',
            mercado:       $('#mercado').val() || '',
            mercado2:      $('#mercado2').val() || '',
            book1:         $('#book1').val() || '',
            vehiculo1:     $('#vehiculo1').val() || '',
            nrExterno:     $('#nrExterno').val() || '',
            tablaFeriados: $('#tablaFeriados1').val() || 'ARG',
            cupon1:        $('#cupon1').val() || '',
            nrOrden1:      $('#nrOrden1').val() || '',
            observaciones: $('#observaciones').val() || '',
            formaLiq1:     parseInt($('input[name="formaLiq1"]:checked').val()) || 0,
            formaLiq2:     parseInt($('input[name="formaLiq2"]:checked').val()) || 0,
            rb5:           parseInt($('input[name="rb5"]:checked').val()) || 0,
            rb9:           parseInt($('input[name="rb9"]:checked').val()) || -1,
            tipoCambio:    parseFloat($('#tipoCambio').val()) || 0,
            totalAux8:     parseFloat($('#totalAux8').val()) || 0,
            cb6:           $('#cb6').is(':checked') ? 1 : 0,
            cb7:           $('#cb7').is(':checked') ? 1 : 0
        };

        var call = 'CrearOperacionVenta(' +
            '"' + esc(params.fechaOp) + '", ' +
            '"' + esc(params.fechaVto) + '", ' +
            '"' + esc(params.fechaPago) + '", ' +
            '"' + esc(params.cliente) + '", ' +
            '"' + esc(params.especie) + '", ' +
            '"' + esc(params.contraespecie) + '", ' +
            '"' + params.cantidad + '", ' +
            '"' + params.precio + '", ' +
            '"' + esc(params.corredor) + '", ' +
            '"' + esc(params.mercado4) + '", ' +
            '"' + esc(params.plataforma) + '", ' +
            '"' + esc(params.mercado) + '", ' +
            '"' + esc(params.mercado2) + '", ' +
            '"' + esc(params.book1) + '", ' +
            '"' + esc(params.vehiculo1) + '", ' +
            '"' + esc(params.nrExterno) + '", ' +
            '"' + esc(params.tablaFeriados) + '", ' +
            '"' + esc(params.cupon1) + '", ' +
            '"' + esc(params.nrOrden1) + '", ' +
            '"' + esc(params.observaciones) + '", ' +
            '"' + params.formaLiq1 + '", ' +
            '"' + params.formaLiq2 + '", ' +
            '"' + params.rb5 + '", ' +
            '"' + params.rb9 + '", ' +
            '"' + params.tipoCambio + '", ' +
            '"' + params.totalAux8 + '", ' +
            '"' + params.cb6 + '", ' +
            '"' + params.cb7 + '"' +
        ')';

        console.log('TIV PPL Call:', call);

        bound.execPPL(call).then(function(result) {
            $$.loading(false);
            $('#btn-crear').prop('disabled', false);

            var nrOp = extractValue(result, 'NrOperacion');
            console.log('TIV: Operacion creada:', nrOp);

            var notifData = {
                NrOperacion: nrOp,
                TipoOp: 'VENTA',
                Especie: params.especie,
                ContraEspecie: params.contraespecie,
                Cliente: params.cliente,
                Cantidad: params.cantidad,
                Precio: params.precio,
                Mercado: params.mercado,
                Mercado4: params.mercado4,
                Book: params.book1,
                Vehiculo: params.vehiculo1
            };

            emitirNotificacion('created', notifData);
            sendNotificationREST('POSI4', 'created', notifData);

            $('#op-creada-nro').text(nrOp);
            $('#modalConfirm').modal('show');
        }).catch(function(err) {
            $$.loading(false);
            $('#btn-crear').prop('disabled', false);
            console.error('Error creando operacion:', err);
            showToast('Error al crear la operacion: ' + (err.message || err), 'error');
        });
    }

    // ========================================================================
    // Extract value from PPL result
    // ========================================================================
    function extractValue(result, key) {
        if (Array.isArray(result)) {
            var item = result.find(function(r) { return r.key && r.key.toLowerCase() === key.toLowerCase(); });
            if (item) return unwrapVal(item.value);
        } else if (result && typeof result === 'object') {
            var v = result[key] || result[key.toLowerCase()];
            return v !== undefined ? unwrapVal(v) : '';
        }
        return typeof result === 'string' ? result.trim() : '';
    }

    // ========================================================================
    // WebSocket - subscribe to POSI4
    // ========================================================================
    function setupWebSocketConnection() {
        console.log('TIV: Conectando WS:', HUB_URL);

        hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(HUB_URL, {
                transport: signalR.HttpTransportType.WebSockets,
                withCredentials: true
            })
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: function(ctx) {
                    return ctx.previousRetryCount < MAX_RECONNECT_ATTEMPTS
                        ? Math.min(RECONNECT_DELAY_MS * Math.pow(2, ctx.previousRetryCount), 30000) : null;
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
                return hubConnection.invoke('Subscribe', 'POSI4');
            })
            .then(function() { console.log('TIV: Suscrito a POSI4'); })
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
        hubConnection.invoke('BroadcastToAll', 'POSI4', payload)
            .then(function() { console.log('TIV: Notificacion WS enviada'); })
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
        var el = $('#ws-status');
        switch (status) {
            case 'connected': el.html('<span class="tiv-ws-dot connected"></span> Conectado'); break;
            case 'reconnecting': el.html('<span class="tiv-ws-dot"></span> Reconectando...'); break;
            default: el.html('<span class="tiv-ws-dot error"></span> Desconectado');
        }
    }

    function formatMoney(value) {
        return '$ ' + value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function showToast(message, type) {
        type = type || 'info';
        var toast = $('<div class="tiv-toast ' + type + '">' + message + '</div>');
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
