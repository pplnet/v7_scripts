/* ============================================================================
   JavaScript: Orden de Venta (OTIV) - Replica completa del dialogo PPL
   ============================================================================
   Formulario completo para ingreso de ordenes de venta (OTIV)
   TipoOrden=OTIV, Direccion=2, TipoOp=TIV
   Notifica al monitor ESTOR2 via WebSocket
   Sin validaciones - solo inputs, labels, valores calculados y DB mapping
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

    // Cached lookup data
    var especies = [];
    var clientes = [];
    var mercados = [];
    var canales = [];
    var vehiculos = [];

    // Key mapping for PPL result capitalization
    var keyMap = {
        'codigo': 'Codigo', 'razonsocial': 'RazonSocial', 'nrcuenta': 'NrCuenta',
        'nombre': 'Nombre', 'descripcion': 'Descripcion', 'tipo': 'Tipo', 'moneda': 'Moneda', 'vteorico': 'VTeorico',
        'vnominal': 'VNominal', 'monedaemision': 'MonedaEmision', 'habilitada': 'Habilitada',
        'status': 'Status', 'esnegociacion': 'EsNegociacion', 'esliquidacion': 'EsLiquidacion',
        'observaciones': 'Observaciones', 'categdepositante': 'CategDepositante',
        'tipocliente': 'TipoCliente', 'condicioniva': 'CondicionIVA', 'alias1': 'Alias1',
        'nrorden': 'NrOrden', 'success': 'Success', 'laminaminima': 'LaminaMinima',
        'interesesc': 'InteresesC', 'plazoliq': 'PlazoLiq',
        'tipocuenta': 'TipoCuenta', 'estado': 'Estado', 'mercado': 'Mercado',
        'cliente': 'Cliente', 'especies': 'Especies', 'permanente': 'Permanente'
    };

    function capitalizeKey(key) {
        if (!key) return key;
        return keyMap[key.toLowerCase()] || (key.charAt(0).toUpperCase() + key.slice(1));
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

    function transformSingleResult(data) {
        if (!data) return null;
        if (data.result !== undefined) data = data.result;
        if (Array.isArray(data) && data.length > 0) {
            if (data[0] && data[0].key !== undefined) {
                var obj = {};
                data.forEach(function(item) {
                    obj[capitalizeKey(item.key)] = unwrapVal(item.value);
                });
                return obj;
            }
            return data[0];
        }
        if (typeof data === 'object' && !Array.isArray(data)) {
            var obj2 = {};
            Object.keys(data).forEach(function(k) {
                obj2[capitalizeKey(k)] = unwrapVal(data[k]);
            });
            return obj2;
        }
        return data;
    }

    // ========================================================================
    // Init
    // ========================================================================
    function init() {
        console.log('OTIV: Inicializando formulario completo de Orden de Venta...');
        setDefaults();
        setupEventListeners();
        loadAllLookups();
        setupWebSocketConnection();
    }

    // ========================================================================
    // Set default values
    // ========================================================================
    function setDefaults() {
        var today = new Date().toISOString().split('T')[0];
        $('#fechaOrden').val(today);
        $('#vtxt30').val('TIV');
        $('#tipoOrden').val('OTIV');
        $('#direccion').val('2');
        $('#mb1').val('NO');
        $('#vtxt28').val('NO');
        $('#vtxt22').val('NO');

        var now = new Date();
        var hh = String(now.getHours()).padStart(2, '0');
        var mm = String(now.getMinutes()).padStart(2, '0');
        var ss = String(now.getSeconds()).padStart(2, '0');
        $('#horaOrden').val(hh + ':' + mm + ':' + ss);
    }

    // ========================================================================
    // Load all lookup data
    // ========================================================================
    function loadAllLookups() {
        loadClientes();
        loadEspecies();
        loadMercados();
        loadCanales();
        loadVehiculos();
        loadOperador();
    }

    function loadClientes() {
        bound.execPPL("GetClientes()").then(function(result) {
            clientes = transformData(result);
            var select = $('#cliente');
            select.empty().append('<option value="">Seleccione...</option>');
            clientes.forEach(function(c) {
                var cuenta = c.NrCuenta ? ' [' + c.NrCuenta + ']' : '';
                select.append('<option value="' + c.Codigo + '">' + c.Codigo + ' - ' + (c.RazonSocial || '') + cuenta + '</option>');
            });
            console.log('OTIV: Clientes cargados:', clientes.length);
        }).catch(function(err) {
            console.error('OTIV: Error cargando clientes:', err);
        });
    }

    function loadEspecies() {
        bound.execPPL("GetEspecies()").then(function(result) {
            especies = transformData(result);
            var select = $('#especie');
            select.empty().append('<option value="">Seleccione...</option>');
            especies.forEach(function(esp) {
                select.append('<option value="' + esp.Codigo + '" data-moneda="' + (esp.Moneda || '') + '" data-vteorico="' + (esp.VTeorico || 0) + '">' +
                    esp.Codigo + ' - ' + (esp.Nombre || '') + '</option>');
            });

            // Also populate contraEspecie with monedas
            var cselect = $('#contraEspecie');
            cselect.empty().append('<option value="">Seleccione...</option>');
            bound.execPPL("GetMonedas()").then(function(r2) {
                var monedas = transformData(r2);
                monedas.forEach(function(m) {
                    cselect.append('<option value="' + m.Codigo + '">' + m.Codigo + ' - ' + (m.Nombre || '') + '</option>');
                });
            }).catch(function() {
                // Fallback - add common currencies
                cselect.append('<option value="ARP">ARP - Pesos</option>');
                cselect.append('<option value="USD">USD - Dolares</option>');
            });

            console.log('OTIV: Especies cargadas:', especies.length);
        }).catch(function(err) {
            console.error('OTIV: Error cargando especies:', err);
        });
    }

    function loadMercados() {
        bound.execPPL("GetMercados()").then(function(result) {
            mercados = transformData(result);
            ['mercado3', 'mercado', 'mercado2'].forEach(function(selId) {
                var sel = $('#' + selId);
                sel.empty().append('<option value="">Seleccione...</option>');
                mercados.forEach(function(m) {
                    sel.append('<option value="' + m.Codigo + '">' + m.Codigo + ' - ' + (m.Descripcion || m.Nombre || '') + '</option>');
                });
            });
        }).catch(function(err) {
            console.error('OTIV: Error cargando mercados:', err);
        });
    }

    function loadCanales() {
        bound.execPPL("GetCanales()").then(function(result) {
            canales = transformData(result);
            var sel = $('#canal1');
            sel.empty().append('<option value="">Seleccione...</option>');
            canales.forEach(function(c) {
                sel.append('<option value="' + c.Codigo + '">' + c.Codigo + '</option>');
            });
        }).catch(function() {
            console.log('OTIV: Canales no disponibles');
        });
    }

    function loadVehiculos() {
        bound.execPPL("GetVehiculos()").then(function(result) {
            var vehs = transformData(result);
            var sel = $('#vehiculo');
            sel.empty().append('<option value="">Seleccione...</option>');
            vehs.forEach(function(v) {
                sel.append('<option value="' + v.Codigo + '">' + v.Codigo + ' - ' + (v.Descripcion || v.Nombre || '') + '</option>');
            });
        }).catch(function() {
            console.log('OTIV: Vehiculos no disponibles');
        });

        bound.execPPL("GetBooks()").then(function(result) {
            var books = transformData(result);
            var sel = $('#book1');
            sel.empty().append('<option value="">Seleccione...</option>');
            books.forEach(function(b) {
                sel.append('<option value="' + b.Codigo + '">' + b.Codigo + ' - ' + (b.Descripcion || b.Nombre || '') + '</option>');
            });
        }).catch(function() {
            console.log('OTIV: Books no disponibles');
        });
    }

    function loadOperador() {
        bound.execPPL("GetOperador()").then(function(result) {
            var val = '';
            if (typeof result === 'string') val = result.trim();
            else if (result && result.result !== undefined) val = unwrapVal(result.result);
            else val = unwrapVal(result);
            $('#operador').val(val);
            $('#leyenda2').val(val);
        }).catch(function() {
            console.log('OTIV: Operador no disponible');
        });
    }

    // ========================================================================
    // Event listeners
    // ========================================================================
    function setupEventListeners() {
        // Form submit
        $('#form-orden').on('submit', function(e) {
            e.preventDefault();
            crearOrden();
        });

        // Buttons
        $('#btn-limpiar').on('click', limpiarFormulario);
        $('#btn-calcular').on('click', recalcular);
        $('#btn-nueva-orden').on('click', function() {
            $('#modalConfirm').modal('hide');
            limpiarFormulario();
        });

        // Observaciones counter
        $('#observaciones').on('input', function() {
            $('#obs-count').text($(this).val().length);
        });

        // Especie change -> update contraEspecie, reload cuentas
        $('#especie').on('change', function() {
            var esp = $(this).val();
            if (esp) {
                var selected = $(this).find(':selected');
                var moneda = selected.data('moneda');
                if (moneda) {
                    $('#contraEspecie').val(moneda);
                }
                loadCuentasTitulo();
                recalcular();
            }
        });

        // Cliente change -> reload cuentas
        $('#cliente').on('change', function() {
            if ($(this).val()) {
                loadCuentasTitulo();
                loadCuentasMoneda();
                recalcular();
            }
        });

        // Mercado change -> reload cuentas
        $('#mercado').on('change', function() {
            loadCuentasTitulo();
        });
        $('#mercado2').on('change', function() {
            loadCuentasMoneda();
        });

        // Plazo change -> update Lotes
        $('#rb5').on('change', function() {
            var v = parseInt($(this).val());
            var lotes = v === 0 ? 0 : v === 1 ? 24 : v === 2 ? 48 : 72;
            $('#lotes').val(lotes);
        });

        // CantidadTotalOrden / PrecioLimite change -> recalc
        $('#cantidadTotalOrden, #precioLimite').on('change', recalcular);

        // Contingencia toggle
        $('#cb7').on('change', function() {
            var isContingencia = $(this).val() === '1';
            $('#cuotas1').prop('disabled', !isContingencia);
        });
    }

    // ========================================================================
    // Load cuentas (titulo and moneda)
    // ========================================================================
    function loadCuentasTitulo() {
        var cliente = $('#cliente').val();
        var especie = $('#especie').val();
        var mercadoLiq = $('#mercado').val();
        if (!cliente || !especie) return;

        var call = 'GetCuentasTitulo("' + esc(cliente) + '", "' + esc(especie) + '", "' + esc(mercadoLiq) + '")';
        bound.execPPL(call).then(function(result) {
            var cuentas = transformData(result);
            var sel = $('#cuenta1');
            sel.empty().append('<option value="">Seleccione...</option>');
            cuentas.forEach(function(c) {
                sel.append('<option value="' + c.Codigo + '">' + c.Codigo + '</option>');
            });
            if (cuentas.length > 0) sel.val(cuentas[0].Codigo);
        }).catch(function() {});
    }

    function loadCuentasMoneda() {
        var cliente = $('#cliente').val();
        var contraEspecie = $('#contraEspecie').val();
        var mercado2 = $('#mercado2').val();
        if (!cliente) return;

        var call = 'GetCuentasMoneda("' + esc(cliente) + '", "' + esc(contraEspecie || '') + '", "' + esc(mercado2 || '') + '", "TIV")';
        bound.execPPL(call).then(function(result) {
            var cuentas = transformData(result);
            ['cuenta4', 'cuenta5'].forEach(function(selId) {
                var sel = $('#' + selId);
                sel.empty().append('<option value="">Seleccione...</option>');
                cuentas.forEach(function(c) {
                    sel.append('<option value="' + c.Codigo + '">' + c.Codigo + '</option>');
                });
                if (cuentas.length > 0) sel.val(cuentas[0].Codigo);
            });
        }).catch(function() {});
    }

    // ========================================================================
    // Recalculate computed fields
    // ========================================================================
    function recalcular() {
        var especie = $('#especie').val();
        var cliente = $('#cliente').val();
        var cantVN = parseFloat($('#cantidadTotalOrden').val()) || 0;
        var precio = parseFloat($('#precioLimite').val()) || 0;

        if (!especie || !cliente || cantVN <= 0) return;

        var call = 'RecalcularOrden("' + esc(especie) + '", "' + esc(cliente) + '", ' +
                   cantVN + ', ' + precio + ', "' + esc($('#contraEspecie').val() || '') + '", "' +
                   esc($('#mercado3').val() || '') + '", "' + esc($('#vehiculo').val() || '') + '", "' +
                   esc($('#fechaOrden').val() || '') + '", ' + ($('#rb5').val() || '0') + ', "' +
                   esc($('#mercado').val() || '') + '", "' + esc($('#book1').val() || '') + '")';

        bound.execPPL(call).then(function(result) {
            var data = transformSingleResult(result);
            if (!data) return;

            // Populate computed fields
            setFieldIfPresent(data, 'Vpre1', '#vpre1');
            setFieldIfPresent(data, 'Vpre10', '#vpre10');
            setFieldIfPresent(data, 'CantidadEnProceso', '#cantidadEnProceso');
            setFieldIfPresent(data, 'Intereses', '#intereses');
            setFieldIfPresent(data, 'Cantidad3', '#cantidad3');
            setFieldIfPresent(data, 'TotalAux1', '#totalAux1');
            setFieldIfPresent(data, 'Vcan2', '#vcan2');
            setFieldIfPresent(data, 'PrecioReal', '#precioReal');
            setFieldIfPresent(data, 'PrecPromCompletado', '#precPromCompletado');
            setFieldIfPresent(data, 'FechaVto', '#fechaVto');
            setFieldIfPresent(data, 'FechaLimite', '#fechaLimite');
            setFieldIfPresent(data, 'Lotes', '#lotes');
            setFieldIfPresent(data, 'Cotizacion1', '#cotizacion1');
            setFieldIfPresent(data, 'Cupon1', '#cupon1');
            setFieldIfPresent(data, 'Vcan17', '#vcan17');
            setFieldIfPresent(data, 'Vtxt3', '#vtxt3');
            setFieldIfPresent(data, 'Vtxt7', '#vtxt7');
            setFieldIfPresent(data, 'Vtxt2', '#vtxt2');
            setFieldIfPresent(data, 'Vpre7', '#vpre7');
            setFieldIfPresent(data, 'Vpre8', '#vpre8');
            setFieldIfPresent(data, 'Vpre13', '#vpre13');
            setFieldIfPresent(data, 'Vpre14', '#vpre14');
            setFieldIfPresent(data, 'TotalAux2', '#totalAux2');
            setFieldIfPresent(data, 'TotalAux3', '#totalAux3');

            // Comisiones
            setFieldIfPresent(data, 'Cantidad10', '#cantidad10');
            setFieldIfPresent(data, 'MontoArancel', '#montoArancel');
            setFieldIfPresent(data, 'IvaArancel', '#ivaArancel');
            setFieldIfPresent(data, 'Impuestos', '#impuestos');
            setFieldIfPresent(data, 'MontoGastos', '#montoGastos');
            setFieldIfPresent(data, 'IvaGastos', '#ivaGastos');
            setFieldIfPresent(data, 'Vtxt16', '#vtxt16');

            // Saldos (OTIV-specific)
            setFieldIfPresent(data, 'Vcan18', '#vcan18');
            setFieldIfPresent(data, 'Vcan28', '#vcan28');
            setFieldIfPresent(data, 'Vcan7', '#vcan7');
            setFieldIfPresent(data, 'Vtxt39', '#vtxt39');
            setFieldIfPresent(data, 'Vcan9', '#vcan9');
            setFieldIfPresent(data, 'Vcan39', '#vcan39');
            setFieldIfPresent(data, 'Vcan8', '#vcan8');
            setFieldIfPresent(data, 'Vcan38', '#vcan38');

            // Limites
            setFieldIfPresent(data, 'Vcan3', '#vcan3');
            setFieldIfPresent(data, 'Vcan5', '#vcan5');
            setFieldIfPresent(data, 'Cantidad9', '#cantidad9');
            setFieldIfPresent(data, 'Vcan47', '#vcan47');
            setFieldIfPresent(data, 'Vtxt19', '#vtxt19');
            setFieldIfPresent(data, 'Vcan11', '#vcan11');
            setFieldIfPresent(data, 'Vtxt10', '#vtxt10');
            setFieldIfPresent(data, 'Vcan40', '#vcan40');
            setFieldIfPresent(data, 'Vtxt25', '#vtxt25');
            setFieldIfPresent(data, 'Vtxt26', '#vtxt26');
            setFieldIfPresent(data, 'Vtxt27', '#vtxt27');
            setFieldIfPresent(data, 'Cantidad6', '#cantidad6');

            // Update summary table
            updateSummary(data);

            console.log('OTIV: Recalculo completado');
        }).catch(function(err) {
            console.error('OTIV: Error en recalculo:', err);
        });
    }

    function setFieldIfPresent(data, key, selector) {
        var val = data[key];
        if (val === undefined || val === null) return;
        if (typeof val === 'number') {
            $(selector).val(formatNumber(val));
        } else {
            $(selector).val(val);
        }
    }

    function updateSummary(data) {
        var monto = parseFloat(data.CantidadEnProceso) || 0;
        var intereses = parseFloat(data.Intereses) || 0;
        var comisiones = parseFloat(data.MontoArancel) || 0;
        var ivaCom = parseFloat(data.IvaArancel) || 0;
        var derechos = parseFloat(data.MontoGastos) || 0;
        var ivaDer = parseFloat(data.IvaGastos) || 0;
        // For sell orders, comisiones and derechos are subtracted (Direccion=-1)
        var total = monto + intereses - (comisiones + ivaCom + derechos + ivaDer);

        $('#sum-monto').text(formatMoney(monto));
        $('#sum-intereses').text(formatMoney(intereses));
        $('#sum-comisiones').text(formatMoney(comisiones));
        $('#sum-iva-com').text(formatMoney(ivaCom));
        $('#sum-derechos').text(formatMoney(derechos));
        $('#sum-iva-der').text(formatMoney(ivaDer));
        $('#sum-total').html('<strong>' + formatMoney(total) + '</strong>');
    }

    // ========================================================================
    // Clear form
    // ========================================================================
    function limpiarFormulario() {
        $('#form-orden')[0].reset();
        setDefaults();
        // Clear all readonly fields
        $('.form-control[readonly]').each(function() {
            var def = $(this).data('default');
            $(this).val(def !== undefined ? def : '');
        });
        $('#obs-count').text('0');
    }

    // ========================================================================
    // Create sell order
    // ========================================================================
    function crearOrden() {
        $$.loading(true);
        $('#btn-crear').prop('disabled', true);

        var params = {
            especie: $('#especie').val(),
            contraEspecie: $('#contraEspecie').val(),
            cliente: $('#cliente').val(),
            cantidadTotalOrden: parseFloat($('#cantidadTotalOrden').val()) || 0,
            precioLimite: parseFloat($('#precioLimite').val()) || 0,
            fechaOrden: $('#fechaOrden').val(),
            fechaVto: $('#fechaVto').val(),
            fechaLimite: $('#fechaLimite').val(),
            lotes: parseInt($('#lotes').val()) || 0,
            mercado3: $('#mercado3').val(),
            ruedaMAE: $('#ruedaMAE').val(),
            mercado: $('#mercado').val(),
            mercado2: $('#mercado2').val(),
            book1: $('#book1').val(),
            vehiculo: $('#vehiculo').val(),
            afectaLS: $('#afectaLS').val(),
            canal1: $('#canal1').val(),
            cuenta1: $('#cuenta1').val(),
            cuenta4: $('#cuenta4').val(),
            cuenta5: $('#cuenta5').val(),
            leyenda1: $('#leyenda1').val(),
            horaOrden: $('#horaOrden').val(),
            tablaFeriados1: $('#tablaFeriados1').val(),
            rb1: parseInt($('#rb1').val()) || 0,
            rb2: parseInt($('#rb2').val()) || 0,
            rb5: parseInt($('#rb5').val()) || 0,
            rb9: parseInt($('#rb9').val()) || 0,
            rb10: parseInt($('#rb10').val()) || 0,
            cb7: parseInt($('#cb7').val()) || 0,
            cuotas1: parseInt($('#cuotas1').val()) || 0,
            observaciones: $('#observaciones').val() || ''
        };

        var call = 'CrearOrdenVenta(' +
            '"' + esc(params.especie) + '", ' +
            '"' + esc(params.contraEspecie) + '", ' +
            '"' + esc(params.cliente) + '", ' +
            '"' + params.cantidadTotalOrden + '", ' +
            '"' + params.precioLimite + '", ' +
            '"' + esc(params.fechaOrden) + '", ' +
            '"' + esc(params.mercado3) + '", ' +
            '"' + esc(params.mercado) + '", ' +
            '"' + esc(params.mercado2) + '", ' +
            '"' + esc(params.book1) + '", ' +
            '"' + esc(params.vehiculo) + '", ' +
            '"' + esc(params.afectaLS) + '", ' +
            '"' + esc(params.canal1) + '", ' +
            '"' + esc(params.cuenta1) + '", ' +
            '"' + esc(params.cuenta4) + '", ' +
            '"' + esc(params.cuenta5) + '", ' +
            '"' + esc(params.leyenda1) + '", ' +
            '"' + esc(params.horaOrden) + '", ' +
            '"' + esc(params.tablaFeriados1) + '", ' +
            '"' + params.lotes + '", ' +
            '"' + params.rb1 + '", ' +
            '"' + params.rb2 + '", ' +
            '"' + params.rb5 + '", ' +
            '"' + params.rb9 + '", ' +
            '"' + params.rb10 + '", ' +
            '"' + params.cb7 + '", ' +
            '"' + params.cuotas1 + '", ' +
            '"' + esc(params.observaciones) + '")';

        console.log('OTIV: Creando orden de venta...');

        bound.execPPL(call).then(function(result) {
            $$.loading(false);
            $('#btn-crear').prop('disabled', false);

            var data = transformSingleResult(result);
            var nrOrden = '';
            if (data) {
                nrOrden = data.NrOrden || data.Nrorden || '';
            }
            if (!nrOrden && typeof result === 'string') nrOrden = result;

            if (nrOrden) {
                $('#nrOrden').val(nrOrden);

                // Notify ESTOR2
                var notificationData = {
                    NrOrden: nrOrden,
                    TipoOrden: 'OTIV',
                    Cliente: params.cliente,
                    Especie: params.especie,
                    Cantidad: params.cantidadTotalOrden,
                    Precio: params.precioLimite,
                    Estado: 'PEN',
                    Direccion: 2
                };

                emitirNotificacion('created', notificationData);
                sendNotificationREST('ESTOR2', 'created', notificationData);

                $('#orden-creada-nro').text(nrOrden);
                $('#modalConfirm').modal('show');

                console.log('OTIV: Orden creada:', nrOrden);
            } else {
                showToast('Orden creada pero no se obtuvo numero', 'info');
            }
        }).catch(function(err) {
            $$.loading(false);
            $('#btn-crear').prop('disabled', false);
            console.error('OTIV: Error creando orden:', err);
            showToast('Error al crear la orden: ' + (err.message || err), 'error');
        });
    }

    // ========================================================================
    // WebSocket
    // ========================================================================
    function setupWebSocketConnection() {
        console.log('OTIV: Conectando WS:', HUB_URL);

        hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(HUB_URL, { transport: signalR.HttpTransportType.WebSockets, withCredentials: true })
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: function(ctx) {
                    return ctx.previousRetryCount < MAX_RECONNECT_ATTEMPTS
                        ? Math.min(RECONNECT_DELAY_MS * Math.pow(2, ctx.previousRetryCount), 30000)
                        : null;
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
            .then(function() { console.log('OTIV: Suscrito a ESTOR2'); })
            .catch(function(err) {
                console.error('OTIV: Error WS:', err);
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
            .then(function() { console.log('OTIV: Notificacion WS enviada'); })
            .catch(function(err) { console.error('OTIV: Error WS notification:', err); });
    }

    function sendNotificationREST(group, action, data) {
        fetch(NOTIFICATIONS_URL + '/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ group: group, messageCode: group, action: action, data: data })
        }).catch(function(err) { console.error('OTIV: Error REST notification:', err); });
    }

    // ========================================================================
    // UI helpers
    // ========================================================================
    function updateWsStatus(status) {
        var el = $('#ws-status');
        switch (status) {
            case 'connected':
                el.html('<span class="otiv-ws-dot connected"></span> Conectado');
                break;
            case 'reconnecting':
                el.html('<span class="otiv-ws-dot"></span> Reconectando...');
                break;
            default:
                el.html('<span class="otiv-ws-dot error"></span> Desconectado');
        }
    }

    function formatMoney(v) {
        return '$ ' + (v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatNumber(v) {
        if (v === 0) return '0';
        if (Math.abs(v) < 0.01) return v.toFixed(8);
        if (Math.abs(v) < 1) return v.toFixed(6);
        return v.toLocaleString('es-AR', { maximumFractionDigits: 4 });
    }

    function esc(s) {
        return (s || '').replace(/"/g, '""').replace(/'/g, "''");
    }

    function showToast(message, type) {
        type = type || 'info';
        var toast = $('<div class="otiv-toast ' + type + '">' + message + '</div>');
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
