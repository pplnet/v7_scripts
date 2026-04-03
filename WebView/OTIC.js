/* ============================================================================
   JavaScript: Orden de Compra OTIC - Replica completa del dialogo PPL
   ============================================================================
   Formulario completo para ingreso de ordenes de compra de titulos
   Notifica al monitor ESTOR2 via WebSocket/REST
   Sin validaciones - solo inputs, labels, calculos y DB mapping
   ============================================================================ */

(function () {
    'use strict';

    // ========================================================================
    // State
    // ========================================================================
    var hubConnection = null;
    var reconnectAttempts = 0;
    var MAX_RECONNECT_ATTEMPTS = 10;
    var RECONNECT_DELAY_MS = 3000;

    var especies = [];
    var clientes = [];
    var mercados = [];
    var canales = [];
    var vehiculos = [];
    var ejecucionCount = 0;

    var API_BASE_URL = window.API_BASE_URL || 'https://localhost:44300';
    var HUB_URL = API_BASE_URL + '/hubs/ppl';
    var NOTIFICATIONS_URL = API_BASE_URL + '/notifications';

    // ========================================================================
    // Key mapping for PPL result normalization
    // ========================================================================
    var keyMap = {
        'codigo': 'Codigo', 'razonsocial': 'RazonSocial', 'nrcuenta': 'NrCuenta',
        'nombre': 'Nombre', 'extendido': 'Extendido', 'tipo': 'Tipo',
        'moneda': 'Moneda', 'monedaemision': 'MonedaEmision',
        'vteorico': 'VTeorico', 'vnominal': 'VNominal',
        'nrorden': 'NrOrden', 'importe': 'Importe',
        'success': 'Success', 'status': 'Status',
        'habilitada': 'Habilitada', 'plazoliq': 'PlazoLiq',
        'cotizaen': 'CotizaEn', 'interesesc': 'InteresesC',
        'afectapordefecto': 'AfectaPorDefecto',
        'editarafectacion': 'EditarAfectacion',
        'esnegociacion': 'EsNegociacion', 'esliquidacion': 'EsLiquidacion',
        'observaciones': 'Observaciones', 'categdepositante': 'CategDepositante',
        'tipocliente': 'TipoCliente', 'condicioniva': 'CondicionIVA', 'alias1': 'Alias1',
        'laminaminima': 'LaminaMinima', 'tipocuenta': 'TipoCuenta',
        'estado': 'Estado', 'mercado': 'Mercado',
        'cliente': 'Cliente', 'especies': 'Especies', 'permanente': 'Permanente'
    };

    function capitalizeKey(key) {
        if (!key) return key;
        return keyMap[key.toLowerCase()] || (key.charAt(0).toUpperCase() + key.slice(1));
    }

    function transformData(data) {
        if (!data) return [];
        if (data.result && Array.isArray(data.result)) data = data.result;
        if (!Array.isArray(data)) return [];
        return data.map(function (row) {
            if (Array.isArray(row)) {
                var obj = {};
                row.forEach(function (item) {
                    if (item && item.key !== undefined)
                        obj[capitalizeKey(item.key)] = unwrapVal(item.value);
                });
                return obj;
            }
            if (row && typeof row === 'object') {
                var obj2 = {};
                Object.keys(row).forEach(function (k) {
                    obj2[capitalizeKey(k)] = unwrapVal(row[k]);
                });
                return obj2;
            }
            return row;
        });
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

    function transformSingleResult(data) {
        if (!data) return null;
        if (data.result !== undefined) data = data.result;
        if (Array.isArray(data) && data.length > 0) {
            if (data[0] && data[0].key !== undefined) {
                var obj = {};
                data.forEach(function (item) {
                    obj[capitalizeKey(item.key)] = unwrapVal(item.value);
                });
                return obj;
            }
            return data[0];
        }
        if (typeof data === 'object' && !Array.isArray(data)) {
            var obj2 = {};
            Object.keys(data).forEach(function (k) {
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
        console.log('OTIC: Inicializando formulario completo...');
        setupCollapsibles();
        setupEventListeners();
        setDefaults();
        loadAllLookups();
        setupWebSocketConnection();
    }

    // ========================================================================
    // Defaults
    // ========================================================================
    function setDefaults() {
        var today = new Date().toISOString().split('T')[0];
        var now = new Date();
        var hh = String(now.getHours()).padStart(2, '0');
        var mm = String(now.getMinutes()).padStart(2, '0');
        var ss = String(now.getSeconds()).padStart(2, '0');

        // Fechas
        $('#fechaOrden').val(today);
        $('#fechaVto').val(today).prop('readonly', false);
        $('#fechaLimite').val(today).prop('readonly', false);
        $('#horaOrden').val(hh + ':' + mm + ':' + ss);

        // Contraespecie
        $('#contraEspecie').val('ARP');

        // Radios - valores por defecto
        $('input[name="rb5"][value="0"]').prop('checked', true);   // Plazo: CI
        $('input[name="rb2"][value="0"]').prop('checked', true);   // Orden Tipo: Cantidad
        $('input[name="rb1"][value="0"]').prop('checked', true);   // Cartera: Trading
        $('input[name="rb9"][value="0"]').prop('checked', true);   // Liquidacion STD
        $('input[name="rb10"][value="0"]').prop('checked', true);  // Liquidacion FD&P
        $('input[name="mb2"][value="1"]').prop('checked', true);   // Bloquea Saldo: SI
        $('input[name="cb7"][value="0"]').prop('checked', true);   // Contingencia: NO

        // Modo
        $('#leyenda1').val('TELEFONICO');

        // Numericos en 0
        $('#cantidadTotalOrden').val('0');
        $('#precioLimite').val('0');
        $('#totalAux1').val('0');

        // Displays calculados
        $('#vpre1-display').text('0');
        $('#cantidadEnProceso-display').text('0');
        $('#cantidad3-display').text('0');
        $('#precioReal-display').text('0');
        $('#precPromCompletado-display').text('0');
        $('#vcan2-display').text('0');
        $('#cantidad10-display').text('0');
        $('#montoArancel-display').text('0');
        $('#ivaArancel-display').text('0');
        $('#montoGastos-display').text('0');
        $('#ivaGastos-display').text('0');
        $('#cotizacion1-display').text('1');
        $('#cb5-display').text('NO');
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
        loadBooks();
        loadOperador();
        loadDefaults();
    }

    function populateClientes(data) {
        clientes = data;
        var select = $('#cliente');
        select.empty().append('<option value="">Seleccione un cliente...</option>');
        clientes.forEach(function (c) {
            var cuenta = c.NrCuenta ? ' [' + c.NrCuenta + ']' : '';
            select.append(
                '<option value="' + c.Codigo + '">' +
                c.Codigo + ' - ' + (c.RazonSocial || '') + cuenta +
                '</option>'
            );
        });
    }

    function loadClientes() {
        bound.execPPL('GetClientes()').then(function (result) {
            populateClientes(transformData(result));
            console.log('OTIC: Clientes cargados:', clientes.length);
        }).catch(function (err) {
            console.warn('OTIC: Error cargando clientes, usando fallback:', err);
            populateClientes([
                { Codigo: '1000000001', RazonSocial: 'Cliente Demo', NrCuenta: '001' }
            ]);
        });
    }

    function populateEspecies(data) {
        especies = data;
        var sel = $('#especie');
        sel.empty().append('<option value="">Seleccione especie...</option>');
        especies.forEach(function (esp) {
            sel.append('<option value="' + esp.Codigo + '">' + esp.Codigo + ' - ' + (esp.Nombre || '') + '</option>');
        });

        // Populate reference list
        var lista = $('#especies-populares');
        if (lista.length) {
            lista.empty();
            especies.slice(0, 10).forEach(function (esp) {
                var precio = esp.VTeorico || 0;
                var li = $(
                    '<li>' +
                    '<span class="ref-code">' + esp.Codigo + '</span>' +
                    '<span class="ref-price">' + (precio > 0 ? formatNum(precio, 4) : '-') + '</span>' +
                    '</li>'
                );
                li.on('click', function () {
                    $('#especie').val(esp.Codigo).trigger('change');
                });
                lista.append(li);
            });
        }
    }

    function loadEspecies() {
        bound.execPPL('GetEspecies()').then(function (result) {
            populateEspecies(transformData(result));
            console.log('OTIC: Especies cargadas:', especies.length);
        }).catch(function (err) {
            console.warn('OTIC: Error cargando especies, usando fallback:', err);
            populateEspecies([
                { Codigo: 'AL30', Nombre: 'Bonar 2030', VTeorico: 1 },
                { Codigo: 'GD30', Nombre: 'Global 2030', VTeorico: 1 },
                { Codigo: 'GGAL', Nombre: 'Galicia', VTeorico: 1 }
            ]);
        });

        // Load monedas into contraEspecie dropdown
        bound.execPPL('GetMonedas()').then(function (result) {
            var monedas = transformData(result);
            var sel = $('#contraEspecie');
            sel.empty().append('<option value="">Seleccione...</option>');
            monedas.forEach(function (m) {
                sel.append('<option value="' + m.Codigo + '">' + m.Codigo + ' - ' + (m.Descripcion || m.Nombre || '') + '</option>');
            });
            // Default contraEspecie = ARP tras cargar las opciones
            if (sel.find('option[value="ARP"]').length > 0) {
                sel.val('ARP');
            }
        }).catch(function () {
            var sel = $('#contraEspecie');
            sel.empty().append('<option value="">Seleccione...</option>');
            sel.append('<option value="ARP">ARP - Pesos</option>');
            sel.append('<option value="USD">USD - Dolares</option>');
        });
    }

    function populateMercados(data) {
        mercados = data;

        var selNeg = $('#mercado3');
        selNeg.empty().append('<option value="">Seleccione...</option>');
        mercados.forEach(function (m) {
            if (m.EsNegociacion === 'SI' || m.EsNegociacion === undefined) {
                selNeg.append('<option value="' + m.Codigo + '">' + m.Codigo + ' - ' + (m.Descripcion || m.Nombre || '') + '</option>');
            }
        });

        ['mercado', 'mercado2'].forEach(function (selId) {
            var sel = $('#' + selId);
            sel.empty().append('<option value="">Seleccione...</option>');
            mercados.forEach(function (m) {
                if (m.EsLiquidacion === 'SI' || m.EsLiquidacion === undefined) {
                    sel.append('<option value="' + m.Codigo + '">' + m.Codigo + ' - ' + (m.Descripcion || m.Nombre || '') + '</option>');
                }
            });
        });
    }

    function loadMercados() {
        bound.execPPL('GetMercados()').then(function (result) {
            populateMercados(transformData(result));
            console.log('OTIC: Mercados cargados:', mercados.length);
        }).catch(function (err) {
            console.warn('OTIC: Error cargando mercados, usando fallback:', err);
            populateMercados([
                { Codigo: 'BYMA', Descripcion: 'BYMA', EsNegociacion: 'SI', EsLiquidacion: 'SI' },
                { Codigo: 'MAE', Descripcion: 'MAE', EsNegociacion: 'SI', EsLiquidacion: 'SI' }
            ]);
        });
    }

    function loadCanales() {
        bound.execPPL('GetCanales()').then(function (result) {
            canales = transformData(result);
            var sel = $('#canal1');
            sel.empty().append('<option value="">Seleccione...</option>');
            canales.forEach(function (c) {
                sel.append('<option value="' + c.Codigo + '">' + c.Codigo + '</option>');
            });
        }).catch(function () {
            var sel = $('#canal1');
            sel.empty().append('<option value="">Seleccione...</option>');
            sel.append('<option value="BOLSA">BOLSA</option>');
            sel.append('<option value="MESA">MESA</option>');
        });
    }

    function loadVehiculos() {
        bound.execPPL('GetVehiculos()').then(function (result) {
            var vehs = transformData(result);
            var sel = $('#vehiculo');
            sel.empty().append('<option value="">Seleccione...</option>');
            vehs.forEach(function (v) {
                sel.append('<option value="' + v.Codigo + '">' + v.Codigo + ' - ' + (v.Descripcion || '') + '</option>');
            });
        }).catch(function () {
            var sel = $('#vehiculo');
            sel.empty().append('<option value="">Seleccione...</option>');
            sel.append('<option value="ALYC">ALYC</option>');
        });
    }

    function loadBooks() {
        bound.execPPL('GetBooks()').then(function (result) {
            var books = transformData(result);
            var sel = $('#book1');
            sel.empty().append('<option value="">Seleccione...</option>');
            books.forEach(function (b) {
                sel.append('<option value="' + b.Codigo + '">' + b.Codigo + ' - ' + (b.Descripcion || '') + '</option>');
            });
        }).catch(function () {
            var sel = $('#book1');
            sel.empty().append('<option value="">Seleccione...</option>');
            sel.append('<option value="TRADING">TRADING</option>');
        });
    }

    function loadOperador() {
        bound.execPPL('GetOperador()').then(function (result) {
            var val = '';
            if (typeof result === 'string') val = result.trim();
            else if (result && result.result) val = String(result.result).trim();
            else {
                var d = transformSingleResult(result);
                val = d ? (d.Operador || d.Usuario || '') : '';
            }
            $('#operador').val(val);
            $('#hid-operador1').val(val);
        }).catch(function () {
            $('#operador').val('SISTEMA');
            $('#hid-operador1').val('SISTEMA');
        });
    }

    function loadDefaults() {
        bound.execPPL('GetDefaults()').then(function (result) {
            var d = transformSingleResult(result);
            if (!d) return;
            if (d.Vehiculo) $('#vehiculo').val(d.Vehiculo);
            if (d.Feriados) $('#tablaFeriados1').val(d.Feriados);
            if (d.Canal) $('#canal1').val(d.Canal);
            if (d.MercaNeg) $('#mercado3').val(d.MercaNeg);
        }).catch(function () {
            // Defaults silenciosos - los valores por defecto ya están seteados en setDefaults()
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

        var call = 'GetCuentasTitulo("' + esc(cliente) + '", "' + esc(especie) + '", "' + esc(mercadoLiq || '') + '")';
        bound.execPPL(call).then(function (result) {
            var cuentas = transformData(result);
            var sel = $('#cuenta1');
            sel.empty().append('<option value="">Seleccione...</option>');
            cuentas.forEach(function (c) {
                sel.append('<option value="' + c.Codigo + '">' + c.Codigo + '</option>');
            });
            if (cuentas.length > 0) sel.val(cuentas[0].Codigo);
        }).catch(function () {});
    }

    function loadCuentasMoneda() {
        var cliente = $('#cliente').val();
        var contraEspecie = $('#contraEspecie').val();
        var mercado2 = $('#mercado2').val();
        if (!cliente) return;

        var call = 'GetCuentasMoneda("' + esc(cliente) + '", "' + esc(contraEspecie || '') + '", "' + esc(mercado2 || '') + '", "TIC")';
        bound.execPPL(call).then(function (result) {
            var cuentas = transformData(result);
            ['cuenta4', 'cuenta5'].forEach(function (selId) {
                var sel = $('#' + selId);
                sel.empty().append('<option value="">Seleccione...</option>');
                cuentas.forEach(function (c) {
                    sel.append('<option value="' + c.Codigo + '">' + c.Codigo + '</option>');
                });
                if (cuentas.length > 0) sel.val(cuentas[0].Codigo);
            });
        }).catch(function () {});
    }

    // ========================================================================
    // Event listeners
    // ========================================================================
    function setupEventListeners() {
        // Form submission
        $('#form-orden').on('submit', function (e) {
            e.preventDefault();
            crearOrden();
        });

        $('#btn-limpiar').on('click', limpiarFormulario);
        $('#btn-nueva-orden').on('click', function () {
            $('#modalConfirm').modal('hide');
            limpiarFormulario();
        });

        // Especie change - reload cuentas and recalc
        $('#especie').on('change', function () {
            var esp = $(this).val();
            if (esp) {
                loadCuentasTitulo();
                recalcular();
                updateSummary();
            }
        });

        // ContraEspecie change - reload moneda cuentas and recalc
        $('#contraEspecie').on('change', function () {
            loadCuentasMoneda();
            recalcular();
        });

        // Cliente change - reload cuentas and recalc
        $('#cliente').on('change', function () {
            if ($(this).val()) {
                loadCuentasTitulo();
                loadCuentasMoneda();
                recalcular();
                updateSummary();
            }
        });

        // Mercado change -> reload cuentas
        $('#mercado').on('change', function () {
            loadCuentasTitulo();
        });
        $('#mercado2').on('change', function () {
            loadCuentasMoneda();
        });

        // Plazo radio change -> recalc
        $('input[name="rb5"]').on('change', function () {
            recalcular();
        });

        // Cantidad / Precio changes -> recalc
        $('#cantidadTotalOrden').on('change input', function () {
            recalcular();
            updateSummary();
        });

        $('#precioLimite').on('change input', function () {
            recalcular();
            updateSummary();
        });

        // RB2 (Tipo Orden: Cantidad/Monto) change
        $('input[name="rb2"]').on('change', function () {
            var rb2 = parseInt($('input[name="rb2"]:checked').val()) || 0;
            if (rb2 === 0) {
                $('#cantidadTotalOrden').prop('readonly', false);
            } else {
                $('#cantidadTotalOrden').prop('readonly', true);
            }
            recalcular();
        });

        // CB7 (Contingencia) change
        $('input[name="cb7"]').on('change', function () {
            var cb7 = parseInt($('input[name="cb7"]:checked').val()) || 0;
            if (cb7 === 1) {
                $('#ejecuciones-card').show();
                $('#cuotas1').prop('readonly', false);
            } else {
                $('#ejecuciones-card').hide();
                $('#cuotas1').val(0);
            }
        });

        // Vehiculo / Book / Mercado3 / FechaOrden changes -> recalc
        $('#vehiculo, #book1, #mercado3, #fechaOrden').on('change', function () {
            recalcular();
        });

        // Ejecuciones
        $('#btn-add-ejecucion').on('click', addEjecucion);
    }

    // ========================================================================
    // Collapsible sections
    // ========================================================================
    function setupCollapsibles() {
        $('.otic-collapsible').on('click', function () {
            var target = $(this).data('target');
            var $body = $('#' + target);
            if ($body.is(':visible')) {
                $body.slideUp(200);
                $(this).addClass('collapsed');
            } else {
                $body.slideDown(200);
                $(this).removeClass('collapsed');
            }
        });
    }

    // ========================================================================
    // Recalculate computed fields via RecalcularOrden
    // ========================================================================
    function recalcular() {
        var especie = $('#especie').val();
        var cliente = $('#cliente').val();
        var cantVN = parseFloat($('#cantidadTotalOrden').val()) || 0;
        var precio = parseFloat($('#precioLimite').val()) || 0;

        if (!especie || !cliente || cantVN <= 0) return;

        var rb5 = parseInt($('input[name="rb5"]:checked').val()) || 0;

        var call = 'RecalcularOrden("' + esc(especie) + '", "' + esc(cliente) + '", ' +
                   cantVN + ', ' + precio + ', "' + esc($('#contraEspecie').val() || '') + '", "' +
                   esc($('#mercado3').val() || '') + '", "' + esc($('#vehiculo').val() || '') + '", "' +
                   esc($('#fechaOrden').val() || '') + '", ' + rb5 + ', "' +
                   esc($('#mercado').val() || '') + '", "' + esc($('#book1').val() || '') + '")';

        bound.execPPL(call).then(function (result) {
            var data = transformSingleResult(result);
            if (!data) return;

            // Populate computed fields into hidden inputs and display elements
            setFieldVal(data, 'Vpre1', '#hid-vpre1');
            setFieldDisplay(data, 'Vpre1', '#vpre1-display', 4);
            setFieldVal(data, 'Vpre10', '#hid-vpre10');
            setFieldDisplay(data, 'CantidadEnProceso', '#cantidadEnProceso-display', 2);
            setFieldDisplay(data, 'Cantidad3', '#cantidad3-display', 2);
            setFieldVal(data, 'Vcan2', '#hid-vcan2');
            setFieldDisplay(data, 'Vcan2', '#vcan2-display', 8);
            setFieldDisplay(data, 'PrecioReal', '#precioReal-display', 8);
            setFieldDisplay(data, 'PrecPromCompletado', '#precPromCompletado-display', 8);

            // Dates
            if (data.FechaVto) $('#fechaVto').val(data.FechaVto);
            if (data.FechaLimite) $('#fechaLimite').val(data.FechaLimite);

            // Lotes
            if (data.Lotes !== undefined) {
                $('#hid-lotes').val(data.Lotes);
                $('#hid-plazo1').val(data.Lotes);
            }

            // Comisiones
            setFieldDisplay(data, 'Cantidad10', '#cantidad10-display', 6);
            setFieldDisplay(data, 'MtoArancel', '#montoArancel-display', 2);
            setFieldDisplay(data, 'IvaArancel', '#ivaArancel-display', 2);
            setFieldDisplay(data, 'MtoGastos', '#montoGastos-display', 2);
            setFieldDisplay(data, 'IvaGastos', '#ivaGastos-display', 2);
            setFieldDisplay(data, 'Cotizacion1', '#cotizacion1-display', 8);
            if (data.Cotizacion1 !== undefined) $('#hid-cotizacion1').val(data.Cotizacion1);

            // Total
            if (data.TotalAux1 !== undefined) {
                $('#totalAux1').val(formatNum(data.TotalAux1, 2));
                $('#sum-total').html('<strong>' + formatNum(data.TotalAux1, 2) + '</strong>');
            }

            // Hidden auxiliary fields
            setFieldVal(data, 'Intereses', '#hid-intereses');
            setFieldVal(data, 'Impuestos', '#hid-impuestos');
            setFieldVal(data, 'Vpre7', '#hid-vpre7');
            setFieldVal(data, 'Vpre8', '#hid-vpre8');
            setFieldVal(data, 'Vpre13', '#hid-vpre13');
            setFieldVal(data, 'Vpre14', '#hid-vpre14');
            setFieldVal(data, 'Vcan17', '#hid-vcan17');
            setFieldVal(data, 'Vtxt3', '#hid-vtxt3');
            setFieldVal(data, 'Vtxt7', '#hid-vtxt7');
            setFieldVal(data, 'Vtxt2', '#hid-vtxt2');
            setFieldVal(data, 'Vtxt16', '#hid-vtxt16');
            setFieldVal(data, 'Cupon1', '#cupon1');
            setFieldVal(data, 'TotalAux2', '#totalAux2-display');
            setFieldVal(data, 'TotalAux3', '#totalAux3-display');

            // Limites
            setFieldVal(data, 'Vcan3', '#hid-vcan3');
            setFieldVal(data, 'Vcan5', '#hid-vcan5');
            setFieldVal(data, 'Cantidad9', '#cantidad9');
            setFieldVal(data, 'Vcan47', '#hid-vcan47');
            setFieldVal(data, 'Vtxt19', '#hid-vtxt19');
            setFieldVal(data, 'Vcan11', '#hid-vcan11');
            setFieldVal(data, 'Vtxt10', '#hid-vtxt10');
            setFieldVal(data, 'Vcan40', '#hid-vcan40');
            setFieldVal(data, 'Vtxt25', '#hid-vtxt25');
            setFieldVal(data, 'Vtxt26', '#hid-vtxt26');
            setFieldVal(data, 'Vtxt27', '#hid-vtxt27');
            setFieldVal(data, 'Cantidad6', '#hid-cantidad6');

            console.log('OTIC: Recalculo completado');
        }).catch(function (err) {
            console.error('OTIC: Error en recalculo:', err);
        });
    }

    function setFieldVal(data, key, selector) {
        var val = data[key];
        if (val === undefined || val === null) return;
        $(selector).val(typeof val === 'number' ? val : val);
    }

    function setFieldDisplay(data, key, selector, decimals) {
        var val = data[key];
        if (val === undefined || val === null) return;
        $(selector).text(formatNum(val, decimals));
    }

    // ========================================================================
    // Update summary panel
    // ========================================================================
    function updateSummary() {
        var esp = $('#especie').val() || '-';
        var cli = $('#cliente option:selected').text() || '-';
        if (cli.length > 20) cli = cli.substring(0, 20) + '...';
        var cant = parseFloat($('#cantidadTotalOrden').val()) || 0;
        var precio = parseFloat($('#precioLimite').val()) || 0;

        $('#sum-especie').text(esp);
        $('#sum-cliente').text(cli);
        $('#sum-cantidad').text(cant > 0 ? formatNum(cant, 0) : '-');
        $('#sum-precio').text(precio > 0 ? formatNum(precio, 8) : '-');
        var monto = cant * precio;
        $('#sum-monto').text(monto > 0 ? formatNum(monto, 2) : '-');
    }

    // ========================================================================
    // Ejecuciones grid
    // ========================================================================
    function addEjecucion() {
        ejecucionCount++;
        var today = new Date().toISOString().split('T')[0];
        var row =
            '<tr data-ejec="' + ejecucionCount + '">' +
            '<td><input type="date" class="form-control ejec-fecha" value="' + today + '" readonly></td>' +
            '<td><input type="text" class="form-control otic-numeric ejec-cantidad" placeholder="0"></td>' +
            '<td><input type="text" class="form-control otic-numeric ejec-precio" placeholder="0.00"></td>' +
            '<td><input type="text" class="form-control ejec-nrsecuencia" placeholder=""></td>' +
            '<td><input type="text" class="form-control ejec-nroperacion" readonly></td>' +
            '<td class="ejec-cantxprec text-right">0</td>' +
            '</tr>';
        $('#ejecuciones-body').append(row);

        var $row = $('[data-ejec="' + ejecucionCount + '"]');
        $row.find('.ejec-cantidad, .ejec-precio').on('change input', function () {
            var c = parseFloat($row.find('.ejec-cantidad').val()) || 0;
            var p = parseFloat($row.find('.ejec-precio').val()) || 0;
            $row.find('.ejec-cantxprec').text(formatNum(c * p, 2));
            recalcEjecucionTotals();
        });
    }

    function recalcEjecucionTotals() {
        var totalCant = 0;
        var totalCantXPrec = 0;
        $('#ejecuciones-body tr').each(function () {
            var c = parseFloat($(this).find('.ejec-cantidad').val()) || 0;
            var p = parseFloat($(this).find('.ejec-precio').val()) || 0;
            totalCant += c;
            totalCantXPrec += c * p;
        });
        $('#cantidad1-display').text(formatNum(totalCant, 2));
        var count = $('#ejecuciones-body tr').length;
        $('#cuotas1').val(count);
        if (totalCant > 0 && count > 0) {
            $('#cantidad4-display').text(formatNum(totalCantXPrec / totalCant, 8));
        }
    }

    // ========================================================================
    // Create order
    // ========================================================================
    function crearOrden() {
        $$.loading(true);
        $('#btn-crear').prop('disabled', true);

        var rb5 = parseInt($('input[name="rb5"]:checked').val()) || 0;
        var lotes = parseInt($('#hid-lotes').val()) || 0;

        var params = {
            especie: $('#especie').val() || '',
            contraEspecie: $('#contraEspecie').val() || '',
            cliente: $('#cliente').val() || '',
            cantidadTotalOrden: parseFloat($('#cantidadTotalOrden').val()) || 0,
            precioLimite: parseFloat($('#precioLimite').val()) || 0,
            fechaOrden: $('#fechaOrden').val() || '',
            mercado3: $('#mercado3').val() || '',
            mercadoLiq: $('#mercado').val() || '',
            mercado2: $('#mercado2').val() || '',
            book1: $('#book1').val() || '',
            vehiculo: $('#vehiculo').val() || '',
            afectaLS: $('#afectaLS').val() || '',
            canal1: $('#canal1').val() || '',
            cuenta1: $('#cuenta1').val() || '',
            cuenta4: $('#cuenta4').val() || '',
            cuenta5: $('#cuenta5').val() || '',
            leyenda1: $('#leyenda1').val() || 'TELEFONICO',
            horaOrden: $('#horaOrden').val() || '',
            tablaFeriados1: $('#tablaFeriados1').val() || '',
            lotes: lotes,
            rb1: parseInt($('input[name="rb1"]:checked').val()) || 0,
            rb2: parseInt($('input[name="rb2"]:checked').val()) || 0,
            rb5: rb5,
            rb9: parseInt($('input[name="rb9"]:checked').val()) || 0,
            rb10: parseInt($('input[name="rb10"]:checked').val()) || 0,
            cb7: parseInt($('input[name="cb7"]:checked').val()) || 0,
            cuotas1: parseInt($('#cuotas1').val()) || 0,
            observaciones: $('#observaciones').val() || ''
        };

        var call = 'CrearOrdenCompra(' +
            '"' + esc(params.especie) + '", ' +
            '"' + esc(params.contraEspecie) + '", ' +
            '"' + esc(params.cliente) + '", ' +
            '"' + params.cantidadTotalOrden + '", ' +
            '"' + params.precioLimite + '", ' +
            '"' + esc(params.fechaOrden) + '", ' +
            '"' + esc(params.mercado3) + '", ' +
            '"' + esc(params.mercadoLiq) + '", ' +
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

        console.log('OTIC: Creando orden...');

        bound.execPPL(call).then(function (result) {
            $$.loading(false);
            $('#btn-crear').prop('disabled', false);

            var data = transformSingleResult(result);
            var nrOrden = '';
            if (data) {
                nrOrden = data.NrOrden || data.Nrorden || '';
            }
            if (!nrOrden && typeof result === 'string') nrOrden = result;

            if (nrOrden) {
                $('#hid-nrOrden').val(nrOrden);
                console.log('OTIC: Orden creada:', nrOrden);

                // Notify ESTOR2
                var notificationData = {
                    NrOrden: nrOrden,
                    TipoOrden: 'OTIC',
                    Cliente: params.cliente,
                    Especie: params.especie,
                    CantidadTotalOrden: params.cantidadTotalOrden,
                    PrecioLimite: params.precioLimite,
                    Estado: 'PEN',
                    Direccion: 1
                };
                emitirNotificacion('created', notificationData);
                sendNotificationREST('ESTOR2', 'created', notificationData);

                // Show confirmation
                $('#orden-creada-nro').text(nrOrden);
                $('#nrorden-display').text(nrOrden).show();
                $('#modalConfirm').modal('show');
            } else {
                showToast('Orden creada pero no se obtuvo numero', 'info');
            }
        }).catch(function (err) {
            $$.loading(false);
            $('#btn-crear').prop('disabled', false);
            console.error('OTIC: Error creando orden:', err);
            showToast('Error al crear la orden: ' + (err.message || err), 'error');
        });
    }

    // ========================================================================
    // Clear form
    // ========================================================================
    function limpiarFormulario() {
        $('#form-orden')[0].reset();
        ejecucionCount = 0;
        $('#ejecuciones-body').empty();
        $('#ejecuciones-card').hide();
        $('#nrorden-display').hide();

        // Reset calculated displays
        $('.otic-field-calc').text('0');
        $('#cb5-display').text('NO');
        $('#cb9-display').text('NO');
        $('#fechaConcrecion-display').text('-');
        $('#vfec10-display').text('-');
        $('#sum-especie, #sum-cliente, #sum-cantidad, #sum-precio, #sum-monto').text('-');
        $('#sum-total').html('<strong>-</strong>');

        // Reset hidden fields
        $('input[type="hidden"]').each(function () {
            var def = $(this).data('default');
            $(this).val(def !== undefined ? def : '');
        });

        // Re-set defaults
        setDefaults();
        loadDefaults();
    }

    // ========================================================================
    // WebSocket
    // ========================================================================
    function setupWebSocketConnection() {
        console.log('OTIC: Conectando WS:', HUB_URL);

        hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(HUB_URL, {
                transport: signalR.HttpTransportType.WebSockets,
                withCredentials: true
            })
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: function (ctx) {
                    return ctx.previousRetryCount < MAX_RECONNECT_ATTEMPTS
                        ? Math.min(RECONNECT_DELAY_MS * Math.pow(2, ctx.previousRetryCount), 30000)
                        : null;
                }
            })
            .configureLogging(signalR.LogLevel.Information)
            .build();

        hubConnection.onreconnecting(function () { updateWsStatus('reconnecting'); });
        hubConnection.onreconnected(function () { reconnectAttempts = 0; updateWsStatus('connected'); });
        hubConnection.onclose(function () {
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
            .then(function () {
                reconnectAttempts = 0;
                updateWsStatus('connected');
                return hubConnection.invoke('Subscribe', 'ESTOR2');
            })
            .then(function () { console.log('OTIC: Suscrito a ESTOR2'); })
            .catch(function (err) {
                console.error('OTIC: Error WS:', err);
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
            .then(function () { console.log('OTIC: Notificacion WS enviada'); })
            .catch(function (err) { console.error('OTIC: Error WS notification:', err); });
    }

    function sendNotificationREST(group, action, data) {
        fetch(NOTIFICATIONS_URL + '/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ group: group, messageCode: group, action: action, data: data })
        }).catch(function (err) { console.error('OTIC: Error REST notification:', err); });
    }

    // ========================================================================
    // UI helpers
    // ========================================================================
    function updateWsStatus(status) {
        var el = $('#ws-status');
        switch (status) {
            case 'connected':
                el.html('<span class="otic-ws-dot connected"></span> Conectado');
                break;
            case 'reconnecting':
                el.html('<span class="otic-ws-dot"></span> Reconectando...');
                break;
            default:
                el.html('<span class="otic-ws-dot error"></span> Desconectado');
        }
    }

    function formatNum(value, decimals) {
        if (value === null || value === undefined || isNaN(value)) return '0';
        decimals = decimals !== undefined ? decimals : 2;
        return Number(value).toLocaleString('es-AR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    function esc(s) {
        return (s || '').replace(/"/g, '""').replace(/'/g, "''");
    }

    function showToast(message, type) {
        type = type || 'info';
        var toast = $('<div class="otic-toast ' + type + '">' + message + '</div>');
        $('body').append(toast);
        setTimeout(function () { toast.fadeOut(300, function () { toast.remove(); }); }, 3000);
    }

    // ========================================================================
    // Cleanup
    // ========================================================================
    window.addEventListener('beforeunload', function () {
        if (hubConnection) hubConnection.stop();
    });

    $(document).ready(function () { init(); });

})();
