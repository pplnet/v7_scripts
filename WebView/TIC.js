/* ============================================================================
   JavaScript: Compra de Titulos - Operacion (Full Dialog Replica)
   ============================================================================
   Replica 1:1 del dialogo de operacion TIC
   Sin validaciones - solo inputs, labels, calculos y DB mapping
   Notifica al monitor POSI4 via WebSocket
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

    // Data caches
    var clientes = [];
    var especies = [];
    var especiesMoneda = [];
    var vehiculos = [];
    var mercadosNeg = [];
    var mercadosLiq = [];
    var books = [];
    var corredores = [];
    var feriados = [];

    // ========================================================================
    // Key mapping - fixes PPL lowercase return keys
    // ========================================================================
    var keyMap = {
        'codigo': 'Codigo', 'razonsocial': 'RazonSocial', 'nombre': 'Nombre',
        'descripcion': 'Descripcion', 'tipo': 'Tipo', 'moneda': 'Moneda',
        'monedaemision': 'MonedaEmision', 'cotiza': 'Cotiza',
        'interesesc': 'InteresesC', 'cotizamae': 'CotizaMAE',
        'codmaecontado': 'CodMAEContado', 'plazoliq': 'PlazoLiq',
        'status': 'Status', 'nroperacion': 'NrOperacion', 'importe': 'Importe',
        'success': 'Success', 'nrorden': 'NrOrden', 'nrmae': 'NrMAE',
        'zerocoupon': 'ZeroCoupon', 'esnegociacion': 'EsNegociacion',
        'esliquidacion': 'EsLiquidacion', 'habilitada': 'Habilitada',
        'alias1': 'Alias1', 'condicioniva': 'CondicionIVA',
        'tipocliente': 'TipoCliente', 'categdepositante': 'CategDepositante',
        'grupoespecie': 'GrupoEspecie', 'jerarquia': 'Jerarquia',
        'vehiculo': 'Vehiculo', 'tiposoperacion': 'TiposOperacion',
        'observaciones': 'Observaciones', 'netea': 'Netea',
        'cliente1': 'Cliente1', 'mercadoneg': 'MercadoNeg',
        'afectacustodia': 'AfectaCustodia', 'issuer': 'Issuer',
        'entidademisora': 'EntidadEmisora', 'tipotitulo': 'TipoTitulo',
        'valor': 'Valor'
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

    function extractValue(result, key) {
        if (Array.isArray(result)) {
            var item = result.find(function(r) { return r.key && r.key.toLowerCase() === key.toLowerCase(); });
            if (item) return unwrapVal(item.value);
        } else if (result && typeof result === 'object') {
            var v = result[key] || result[key.toLowerCase()] || result[key.charAt(0).toLowerCase() + key.slice(1)];
            return v !== undefined ? unwrapVal(v) : '';
        }
        return typeof result === 'string' ? result.trim() : '';
    }

    function extractScalar(result) {
        if (result === null || result === undefined) return '';
        if (typeof result === 'string') return result.trim();
        if (typeof result === 'number') return result;
        if (Array.isArray(result)) {
            if (result.length === 1) {
                var r = result[0];
                if (r && r.key !== undefined) return unwrapVal(r.value);
                return r;
            }
            if (result.length > 0 && result[0] && result[0].key !== undefined)
                return unwrapVal(result[0].value);
        }
        if (result && typeof result === 'object') {
            if (result.val !== undefined) return unwrapVal(result.val);
            if (result.value !== undefined) return unwrapVal(result.value);
            var keys = Object.keys(result);
            if (keys.length === 1) return unwrapVal(result[keys[0]]);
            if (result.result !== undefined) return extractScalar(result.result);
        }
        return result;
    }

    // ========================================================================
    // Searchable Combo - Convierte <select> en combos filtrables
    // ========================================================================
    function initSearchableCombos() {
        var exclude = [];
        $('.tic-app select.form-control').each(function () {
            var sel = $(this);
            var id = sel.attr('id') || '';
            if (exclude.indexOf(id) >= 0) return;
            wrapSelectAsCombo(sel);
        });
    }

    function wrapSelectAsCombo(sel) {
        var id = sel.attr('id') || '';
        sel.hide();
        var wrapper = $('<div class="tic-combo"></div>');
        var input = $('<input type="text" class="tic-combo-input" autocomplete="off" placeholder="Seleccione...">');
        var arrow = $('<span class="tic-combo-arrow">&#9660;</span>');
        var dropdown = $('<div class="tic-combo-dropdown"></div>');
        if (id) input.attr('data-combo-for', id);
        sel.after(wrapper);
        wrapper.append(input).append(arrow).append(dropdown);

        syncInputFromSelect(sel, input);
        sel.on('change.combo', function () { syncInputFromSelect(sel, input); });
        var observer = new MutationObserver(function () { syncInputFromSelect(sel, input); });
        observer.observe(sel[0], { childList: true });

        input.on('focus', function () {
            buildDropdownOptions(sel, dropdown, input.val());
            wrapper.addClass('open');
            input.select();
        });
        input.on('input', function () {
            buildDropdownOptions(sel, dropdown, input.val());
            if (!wrapper.hasClass('open')) wrapper.addClass('open');
        });
        input.on('keydown', function (e) {
            var items = dropdown.find('.tic-combo-option');
            var highlighted = dropdown.find('.highlighted');
            var idx = items.index(highlighted);
            if (e.keyCode === 40) { e.preventDefault(); if (idx < items.length - 1) { items.removeClass('highlighted'); $(items[idx + 1]).addClass('highlighted'); scrollIntoViewIfNeeded(items[idx + 1], dropdown[0]); } }
            else if (e.keyCode === 38) { e.preventDefault(); if (idx > 0) { items.removeClass('highlighted'); $(items[idx - 1]).addClass('highlighted'); scrollIntoViewIfNeeded(items[idx - 1], dropdown[0]); } }
            else if (e.keyCode === 13) { e.preventDefault(); if (highlighted.length) { selectOption(sel, input, wrapper, highlighted.attr('data-value'), highlighted.text()); } }
            else if (e.keyCode === 27) { closeCombo(sel, input, wrapper); }
            else if (e.keyCode === 9) { closeCombo(sel, input, wrapper); }
        });
        dropdown.on('mousedown', '.tic-combo-option', function (e) {
            e.preventDefault();
            var opt = $(this);
            selectOption(sel, input, wrapper, opt.attr('data-value'), opt.text());
        });
        input.on('blur', function () { setTimeout(function () { closeCombo(sel, input, wrapper); }, 150); });
    }

    function buildDropdownOptions(sel, dropdown, filter) {
        dropdown.empty();
        var q = (filter || '').toLowerCase();
        var hasResults = false;
        sel.find('option').each(function () {
            var opt = $(this);
            var val = opt.val();
            var text = opt.text();
            if (!val && text.indexOf('Seleccione') >= 0) return;
            if (q && text.toLowerCase().indexOf(q) < 0 && val.toLowerCase().indexOf(q) < 0) return;
            var div = $('<div class="tic-combo-option"></div>').attr('data-value', val).text(text);
            if (val === sel.val()) div.addClass('selected');
            if (!hasResults) div.addClass('highlighted');
            dropdown.append(div);
            hasResults = true;
        });
        if (!hasResults) dropdown.append('<div class="tic-combo-empty">Sin resultados</div>');
    }

    function selectOption(sel, input, wrapper, value, text) {
        sel.val(value).trigger('change');
        input.val(text);
        wrapper.removeClass('open');
    }

    function closeCombo(sel, input, wrapper) {
        wrapper.removeClass('open');
        var currentVal = sel.val();
        if (currentVal) { input.val(sel.find('option:selected').text()); }
        else { input.val(''); }
    }

    function syncInputFromSelect(sel, input) {
        var val = sel.val();
        if (val) { input.val(sel.find('option:selected').text()); }
        else { input.val(''); }
    }

    function scrollIntoViewIfNeeded(el, container) {
        var elTop = el.offsetTop;
        var elBottom = elTop + el.offsetHeight;
        var cTop = container.scrollTop;
        var cBottom = cTop + container.clientHeight;
        if (elTop < cTop) container.scrollTop = elTop;
        else if (elBottom > cBottom) container.scrollTop = elBottom - container.clientHeight;
    }

    // ========================================================================
    // Formateo numérico con separador de miles (punto)
    // ========================================================================
    function formatNumericInput(input) {
        input.on('input', function () {
            var el = this;
            var cursorPos = el.selectionStart;
            var raw = el.value.replace(/\./g, '').replace(/,/g, '.');
            raw = raw.replace(/[^0-9.\-]/g, '');
            if (raw === '' || raw === '-') return;
            var parts = raw.split('.');
            var intPart = parts[0];
            var decPart = parts.length > 1 ? parts[1] : null;
            var sign = '';
            if (intPart.charAt(0) === '-') { sign = '-'; intPart = intPart.substring(1); }
            intPart = intPart.replace(/^0+(?=\d)/, '');
            var formatted = sign + intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            if (decPart !== null) formatted += ',' + decPart;
            var prevLen = el.value.length;
            el.value = formatted;
            var diff = el.value.length - prevLen;
            el.setSelectionRange(cursorPos + diff, cursorPos + diff);
        });
    }

    function parseNumericInput(selector) {
        var val = $(selector).val() || '';
        return parseFloat(val.replace(/\./g, '').replace(/,/g, '.')) || 0;
    }

    // ========================================================================
    // Init
    // ========================================================================
    function init() {
        console.log('TIC: Inicializando formulario completo...');

        var defaultDate = '2026-04-08';
        $('#fechaOp').val(defaultDate);

        // Default Plazo: 24hs
        $('input[name="rb5"][value="1"]').prop('checked', true);

        setupEventListeners();
        loadAllCombos();
        loadOperador();
        setTimeout(initSearchableCombos, 500);
        setupWebSocketConnection();

        // Calcular FechaLiq con plazo default 24hs
        onPlazoChange();
    }

    function loadAllCombos() {
        loadClientes();
        loadEspecies();
        loadContraEspecies();
        loadVehiculos();
        loadMercadosNeg();
        loadMercadosLiq();
        loadBooks();
        loadCorredores();
        loadFeriados();
    }

    // ========================================================================
    // Load combos via PPL
    // ========================================================================
    function loadClientes() {
        bound.execPPL("GetClientes()").then(function(result) {
            clientes = transformData(result);
            var sel = $('#clienteId');
            sel.find('option:not(:first)').remove();
            clientes.forEach(function(c) {
                sel.append('<option value="' + c.Codigo + '">' + c.Codigo + ' - ' + (c.RazonSocial || '') + '</option>');
            });
            console.log('TIC: Clientes cargados:', clientes.length);
        }).catch(function(err) { console.error('Error cargando clientes:', err); });
    }

    function loadEspecies() {
        bound.execPPL("GetEspecies()").then(function(result) {
            especies = transformData(result);
            var sel = $('#especie');
            sel.empty().append('<option value="">Seleccione...</option>');
            especies.forEach(function(e) {
                sel.append('<option value="' + e.Codigo + '" data-tipo="' + (e.Tipo || '') + '" data-moneda="' + (e.MonedaEmision || e.Moneda || '') + '">' +
                    e.Codigo + ' - ' + (e.Nombre || '') + '</option>');
            });
            console.log('TIC: Especies cargados:', especies.length);
        }).catch(function(err) { console.error('Error cargando especies:', err); });
    }

    function loadContraEspecies() {
        bound.execPPL("GetContraEspecies()").then(function(result) {
            especiesMoneda = transformData(result);
            var sel = $('#contraespecie');
            sel.find('option:not(:first)').remove();
            especiesMoneda.forEach(function(e) {
                sel.append('<option value="' + e.Codigo + '">' + e.Codigo + ' - ' + (e.Nombre || '') + '</option>');
            });
        }).catch(function(err) { console.error('Error cargando contraespecies:', err); });
    }

    function loadVehiculos() {
        bound.execPPL("GetVehiculos()").then(function(result) {
            vehiculos = transformData(result);
            var sel = $('#vehiculo1');
            sel.find('option:not(:first)').remove();
            vehiculos.forEach(function(v) {
                sel.append('<option value="' + v.Codigo + '">' + v.Codigo + ' - ' + (v.Descripcion || '') + '</option>');
            });
            // Default Vehiculo: STD
            if (sel.find('option[value="STD"]').length > 0) sel.val('STD');
        }).catch(function(err) { console.error('Error cargando vehiculos:', err); });
    }

    function loadMercadosNeg() {
        bound.execPPL("GetMercadosNeg()").then(function(result) {
            mercadosNeg = transformData(result);
            var sel = $('#mercado4');
            sel.find('option:not(:first)').remove();
            mercadosNeg.forEach(function(m) {
                sel.append('<option value="' + m.Codigo + '">' + m.Codigo + ' - ' + (m.Descripcion || '') + '</option>');
            });
            // Default Merc. Negociacion: A3
            if (sel.find('option[value="A3"]').length > 0) sel.val('A3');
        }).catch(function(err) { console.error('Error cargando mercados neg:', err); });
    }

    function loadMercadosLiq() {
        bound.execPPL("GetMercadosLiq()").then(function(result) {
            mercadosLiq = transformData(result);
            ['#mercado', '#mercado2'].forEach(function(selId) {
                var sel = $(selId);
                sel.find('option:not(:first)').remove();
                mercadosLiq.forEach(function(m) {
                    sel.append('<option value="' + m.Codigo + '">' + m.Codigo + ' - ' + (m.Descripcion || '') + '</option>');
                });
            });
            // Default Merc. Liq. Esp.: MC
            if ($('#mercado').find('option[value="MC"]').length > 0) $('#mercado').val('MC');
            // Default Merc. Liq. Mon.: BCRA
            if ($('#mercado2').find('option[value="BCRA"]').length > 0) $('#mercado2').val('BCRA');
        }).catch(function(err) { console.error('Error cargando mercados liq:', err); });
    }

    function loadBooks() {
        bound.execPPL("GetBooks()").then(function(result) {
            books = transformData(result);
            var sel = $('#book1');
            sel.find('option:not(:first)').remove();
            books.forEach(function(b) {
                sel.append('<option value="' + b.Codigo + '">' + b.Codigo + '</option>');
            });
            // Default Book: TITULOS
            if (sel.find('option[value="TITULOS"]').length > 0) sel.val('TITULOS');
        }).catch(function(err) { console.error('Error cargando books:', err); });
    }

    function loadCorredores() {
        bound.execPPL("GetCorredores()").then(function(result) {
            corredores = transformData(result);
            var sel = $('#corredor');
            sel.find('option:not(:first)').remove();
            corredores.forEach(function(c) {
                sel.append('<option value="' + c.Codigo + '">' + c.Codigo + ' - ' + (c.Nombre || c.Descripcion || '') + '</option>');
            });
        }).catch(function(err) { console.error('Error cargando corredores:', err); });
    }

    function loadFeriados() {
        bound.execPPL("GetFeriados()").then(function(result) {
            feriados = transformData(result);
            var sel = $('#tablaFeriados1');
            sel.empty();
            feriados.forEach(function(f) {
                sel.append('<option value="' + f.Codigo + '">' + f.Codigo + '</option>');
            });
            if (feriados.length === 0) {
                sel.append('<option value="ARG">ARG</option>');
                sel.append('<option value="USA">USA</option>');
            }
        }).catch(function(err) {
            console.error('Error cargando feriados:', err);
        });
    }

    function loadOperador() {
        bound.execPPL("GetOperador()").then(function(result) {
            var op = extractScalar(result);
            $('#operador').val(op || '');
        }).catch(function(err) { console.error('Error cargando operador:', err); });
    }

    // ========================================================================
    // Event listeners
    // ========================================================================
    function setupEventListeners() {
        // Formateo numérico con separador de miles
        formatNumericInput($('#cantidad'));
        formatNumericInput($('#precio1'));

        // Calculation triggers
        $('#cantidad, #precio1').on('input', recalcularMontos);
        $('input[name="rb5"]').on('change', onPlazoChange);
        $('#fechaOp').on('change', onFechaOpChange);
        $('#tablaFeriados1').on('change', onPlazoChange);

        // Species change triggers lookups
        $('#especie').on('change', onEspecieChange);
        $('#contraespecie').on('change', recalcularMontos);
        $('#clienteId').on('change', onClienteChange);
        $('#vehiculo1').on('change', onVehiculoChange);

        // Forma liquidacion visibility
        $('#mercado4').on('change', onMercado4Change);

        // Form actions
        $('#btn-limpiar').on('click', limpiarFormulario);
        $('#btn-recalcular').on('click', recalcularTodo);
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
    // Field change handlers
    // ========================================================================
    function onEspecieChange() {
        var especie = $('#especie').val();
        if (!especie) return;

        // Lookup ContraEspecie default (CotizaEn)
        bound.execPPL('GetCotizaEn("' + especie + '")').then(function(result) {
            var ce = extractScalar(result);
            if (ce) $('#contraespecie').val(ce);
        }).catch(function() {});

        // Lookup species properties
        bound.execPPL('GetEspecieProps("' + especie + '")').then(function(result) {
            var data = transformData(result);
            if (data.length > 0) {
                var props = data[0];
                $('#vtxt14').val(props.MonedaEmision || '');
                $('#vtxt3').val(props.InteresesC || '');
                $('#vtxt8').val(props.ZeroCoupon || '');
                $('#enteCus1').val(props.CodMAEContado || '');
                $('#vpre21').val(props.EsTasa === 'SI' ? '1' : '0');
                $('#esTBills').val(props.Tipo === 'TBL' ? 'SI' : 'NO');
            }
        }).catch(function() {});

        // Lookup PlazoLiq default for RB5
        bound.execPPL('GetPlazoLiq("' + especie + '")').then(function(result) {
            var plazo = extractScalar(result);
            if (plazo !== '' && plazo !== null && plazo !== undefined) {
                var rb5Val = '0';
                if (plazo === '0' || plazo === 0) rb5Val = '0';
                else if (plazo === '24' || plazo === 24) rb5Val = '1';
                else if (plazo === '48' || plazo === 48) rb5Val = '2';
                $('input[name="rb5"][value="' + rb5Val + '"]').prop('checked', true);
                onPlazoChange();
            }
        }).catch(function() {});

        recalcularMontos();
    }

    function onClienteChange() {
        var cliente = $('#clienteId').val();
        if (!cliente) return;

        // Lookup NrMAE
        bound.execPPL('GetClienteNrMAE("' + cliente + '")').then(function(result) {
            $('#vtxt12').val(extractScalar(result) || '');
        }).catch(function() {});

        // Lookup CondicionIVA
        bound.execPPL('GetClienteCondIVA("' + cliente + '")').then(function(result) {
            $('#vtxt16').val(extractScalar(result) || '');
        }).catch(function() {});

        // Check if ClienteCP
        bound.execPPL('GetClienteCP("' + cliente + '", "' + ($('#vehiculo1').val() || '') + '")').then(function(result) {
            $('#vtxt17').val(extractScalar(result) || '0');
        }).catch(function() {});
    }

    function onVehiculoChange() {
        // Refresh client CP flag
        var cliente = $('#clienteId').val();
        var vehiculo = $('#vehiculo1').val();
        if (cliente && vehiculo) {
            bound.execPPL('GetClienteCP("' + cliente + '", "' + vehiculo + '")').then(function(result) {
                $('#vtxt17').val(extractScalar(result) || '0');
            }).catch(function() {});
        }
    }

    function onFechaOpChange() {
        onPlazoChange();
    }

    function addCalendarDays(dateStr, days) {
        var d = new Date(dateStr + 'T00:00:00');
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    }

    /** Normaliza cualquier formato de fecha a yyyy-MM-dd para input[type=date] */
    function toDateInputFormat(val) {
        if (!val) return '';
        var s = String(val).trim();
        // Ya es yyyy-MM-dd
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        // dd/MM/yyyy o dd/MM/yyyy HH:mm:ss
        var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (m) return m[3] + '-' + m[2] + '-' + m[1];
        // yyyy-MM-ddTHH:mm:ss (ISO con tiempo)
        if (s.length > 10 && s.charAt(4) === '-') return s.substring(0, 10);
        // Intentar parsear con Date
        var d = new Date(s);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        return '';
    }

    function setFechaLiq(fv) {
        var normalized = toDateInputFormat(fv);
        if (normalized) {
            $('#fechaVto').val(normalized);
            $('#fechaPago').val(normalized);
        }
    }

    function onPlazoChange() {
        var rb5 = parseInt($('input[name="rb5"]:checked').val()) || 0;
        var plazo = 0;
        if (rb5 === 0) plazo = 0;
        else if (rb5 === 1) plazo = 24;
        else if (rb5 === 2) plazo = 48;

        $('#plazo').val(plazo);

        var fechaOp = $('#fechaOp').val();
        if (!fechaOp) return;

        var diasHabiles = plazo / 24;

        // Calcular inmediatamente con dias corridos
        setFechaLiq(addCalendarDays(fechaOp, diasHabiles));

        // Si el backend está disponible, recalcular con dias habiles + feriados
        if (typeof bound !== 'undefined' && bound.execPPL) {
            var feriados = $('#tablaFeriados1').val() || 'ARG';
            try {
                bound.execPPL('CalcFechaVto("' + fechaOp + '", ' + diasHabiles + ', "' + feriados + '")').then(function(result) {
                    var fv = extractScalar(result);
                    if (fv) setFechaLiq(fv);
                }).catch(function() {});
            } catch(e) {}
        }
    }

    function onMercado4Change() {
        // Visibility of plataforma depends on mercado4 == AMBMAE
        // We just show it always for simplicity, the PPL backend handles defaults
    }

    // ========================================================================
    // Recalculate computed fields
    // ========================================================================
    function recalcularMontos() {
        var cantidad = parseNumericInput('#cantidad');
        var precio = parseNumericInput('#precio1');
        var bruto = cantidad * precio;

        $('#totalBrutoCli1').val(bruto > 0 ? formatMoney(bruto) : '');
        $('#vcan33').val(bruto > 0 ? formatMoney(bruto) : '');
        $('#totalNetoCli1').val(bruto > 0 ? formatMoney(bruto) : '');
        $('#vcan22').val('');
        $('#totalIntereses').val('');
        $('#totalComisiones').val('');
    }

    function recalcularTodo() {
        var especie = $('#especie').val() || '';
        var contraespecie = $('#contraespecie').val();
        var cliente = $('#clienteId').val();
        var vehiculo = $('#vehiculo1').val();
        var cantidad = parseNumericInput('#cantidad');
        var precio = parseNumericInput('#precio1');
        var fechaOp = $('#fechaOp').val();
        var fechaVto = $('#fechaVto').val();
        var mercado4 = $('#mercado4').val();
        var mercado = $('#mercado').val();
        var corredor = $('#corredor').val();
        var book = $('#book1').val();

        if (!especie || !cantidad || !precio) {
            recalcularMontos();
            return;
        }

        // Full server-side recalculation
        var params = [
            '"' + (especie || '') + '"',
            '"' + (contraespecie || '') + '"',
            '"' + (cliente || '') + '"',
            '"' + (vehiculo || '') + '"',
            cantidad,
            precio,
            '"' + (fechaOp || '') + '"',
            '"' + (fechaVto || '') + '"',
            '"' + (mercado4 || '') + '"',
            '"' + (mercado || '') + '"',
            '"' + (corredor || '') + '"',
            '"' + (book || '') + '"'
        ].join(', ');

        bound.execPPL('RecalcularCampos(' + params + ')').then(function(result) {
            var data = {};
            if (Array.isArray(result)) {
                result.forEach(function(item) {
                    if (item && item.key !== undefined) {
                        data[capitalizeKey(item.key)] = typeof item.value === 'string' ? item.value.trim() : item.value;
                    }
                });
            } else if (result && typeof result === 'object') {
                Object.keys(result).forEach(function(k) {
                    data[capitalizeKey(k)] = result[k];
                });
            }

            // Update calculated fields
            setCalcField('#totalBrutoCli1', data.TotalBrutoCli1);
            setCalcField('#vcan33', data.Vcan33 || data.VCAN33);
            setCalcField('#vcan22', data.Vcan22 || data.VCAN22);
            setCalcField('#totalNetoCli1', data.TotalNetoCli1);
            setCalcField('#totalIntereses', data.TotalIntereses);
            setCalcField('#totalComisiones', data.TotalComisiones);
            setCalcField('#tipoCambio', data.TipoCambio);
            setCalcField('#totalAux8', data.TotalAux8);

            // Tab 2 calculated fields
            setCalcField('#porArancel', data.PorArancel);
            setCalcField('#totalAux2', data.TotalAux2);
            setCalcField('#totalIva', data.TotalIva);
            setCalcField('#totalGastos', data.TotalGastos);
            setCalcField('#totalIvaAdi', data.TotalIvaAdi);
            setCalcField('#totalAux4', data.TotalAux4);
            setCalcField('#tasaInteresesCupon', data.TasaInteresesCupon);
            setCalcField('#vpre13', data.Vpre13 || data.VPRE13);
            setCalcField('#vpre14', data.Vpre14 || data.VPRE14);
            setCalcField('#precio4', data.Precio4);
            setCalcField('#totalNetoCli3', data.TotalNetoCli3);
            setCalcField('#vcan7', data.Vcan7 || data.VCAN7);
            setCalcField('#porImpuestoBolsa', data.PorImpuestoBolsa);
            setCalcField('#porDerechoBolsa', data.PorDerechoBolsa);

            // Hidden computed values
            setHidden('#cupon1', data.Cupon1);
            setHidden('#fechaUltCupon', data.FechaUltCupon);
            setHidden('#vtxt3', data.Vtxt3 || data.VTXT3);
            setHidden('#vtxt14', data.Vtxt14 || data.VTXT14);
            setHidden('#vtxt13', data.Vtxt13 || data.VTXT13);
            setHidden('#vcan1', data.Vcan1 || data.VCAN1);
            setHidden('#vpre21', data.Vpre21 || data.VPRE21);
            setHidden('#parkMoneda', data.ParkMoneda);
            setHidden('#parkTipoDol', data.ParkTipoDol);
            setHidden('#parkJuris', data.ParkJuris);
            setHidden('#parkAfecta', data.ParkAfecta);
            setHidden('#ddjjRequiere', data.DDJJRequiere);
            setHidden('#ddjjCodigo', data.DDJJCodigo);

            // Show cupon/interes fields in avanzado
            if (data.Cupon1) $('#cupon1').val(data.Cupon1);
            if (data.FechaUltCupon) $('#fechaUltCupon').val(data.FechaUltCupon);

            console.log('TIC: Recalculo completado');
        }).catch(function(err) {
            console.error('Error en recalculo:', err);
            // Fallback to basic calculation
            recalcularMontos();
        });
    }

    function setCalcField(selector, value) {
        if (value !== undefined && value !== null && value !== '') {
            var num = parseFloat(value);
            $(selector).val(isNaN(num) ? value : formatMoney(num));
        }
    }

    function setHidden(selector, value) {
        if (value !== undefined && value !== null) {
            $(selector).val(value);
        }
    }

    // ========================================================================
    // Clear form
    // ========================================================================
    function limpiarFormulario() {
        $('#form-op')[0].reset();
        $('#fechaOp').val('2026-04-08');
        // Reset calculated fields
        $('#totalBrutoCli1, #vcan33, #vcan22, #totalNetoCli1, #totalIntereses, #totalComisiones').val('');
        $('#tipoCambio, #totalAux8').val('');
        $('#porArancel, #totalAux2, #totalIva, #totalGastos, #totalIvaAdi, #totalAux4').val('');
        $('#tasaInteresesCupon, #vpre13, #vpre14, #precio4').val('');
        $('#totalNetoCli3, #vcan7, #porImpuestoBolsa, #porDerechoBolsa').val('');
        $('#operador').val('');
        $('#parkMoneda, #parkTipoDol, #parkJuris, #parkAfecta, #ddjjCodigo, #ddjjRequiere').val('');

        // Reset radio buttons to defaults
        $('input[name="rb5"][value="1"]').prop('checked', true);  // 24hs default
        $('input[name="formaLiquidacion1"][value="0"]').prop('checked', true);
        $('input[name="formaLiquidacion2"][value="1"]').prop('checked', true);
        $('input[name="rb6"][value="1"]').prop('checked', true);
        $('input[name="rb9"][value="-1"]').prop('checked', true);
        $('input[name="cartera"][value="0"]').prop('checked', true);
        $('input[name="rb3"][value="0"]').prop('checked', true);
        $('input[name="convenio"][value="0"]').prop('checked', true);

        // Reset hidden fields
        $('input[type="hidden"]').val('');
        $('#cb2').val('0');
        $('#cb5').val('0');
        $('#vtxt17').val('0');
        $('#vtxt30').val('NO');
        $('#vtxt31').val('NO');
        $('#vcan1').val('0');
        $('#vpre21').val('0');
        $('#corporate').val('0');
        $('#tipoTicket').val('0');

        loadOperador();

        // Recalcular Fecha Liq con plazo default
        onPlazoChange();
    }

    // ========================================================================
    // Create operation - full insert with ALL fields
    // ========================================================================
    function crearOperacion() {
        $$.loading(true);
        $('#btn-crear').prop('disabled', true);

        function esc(s) { return (s || '').replace(/'/g, "''"); }

        // Collect ALL form values
        var fechaOp = $('#fechaOp').val() || '';
        var fechaVto = $('#fechaVto').val() || '';
        var fechaPago = $('#fechaPago').val() || '';
        var especie = $('#especie').val() || '';
        var contraEspecie = $('#contraespecie').val() || '';
        var cliente1 = $('#clienteId').val() || '';
        var cantidad = parseNumericInput('#cantidad');
        var precio1 = parseNumericInput('#precio1');
        var corredor = $('#corredor').val() || '';
        var mercado4 = $('#mercado4').val() || '';
        var plataforma = $('#plataforma').val() || '';
        var mercado = $('#mercado').val() || '';
        var mercado2 = $('#mercado2').val() || '';
        var book1 = $('#book1').val() || '';
        var vehiculo1 = $('#vehiculo1').val() || '';
        var tablaFeriados1 = $('#tablaFeriados1').val() || '';
        var nrExterno = $('#nrExterno').val() || '';
        var nrOrden1 = $('#nrOrden1').val() || '';
        var opSIOPEL = $('#opSiopel').val() || '';
        var observaciones = $('#observaciones').val() || '';
        var rb5 = parseInt($('input[name="rb5"]:checked').val()) || 0;
        var plazo = parseInt($('#plazo').val()) || 0;
        var formaLiq1 = parseInt($('input[name="formaLiquidacion1"]:checked').val()) || 0;
        var formaLiq2 = parseInt($('input[name="formaLiquidacion2"]:checked').val()) || 0;
        var rb6 = parseInt($('input[name="rb6"]:checked').val()) || 1;
        var rb9 = parseInt($('input[name="rb9"]:checked').val()) || -1;
        var cartera = parseInt($('input[name="cartera"]:checked').val()) || 0;
        var cb6 = $('#cb6').is(':checked') ? 1 : 0;
        var cb7 = $('#cb7').is(':checked') ? 1 : 0;
        var cb10 = $('#cb10').is(':checked') ? 1 : 0;
        var convenio = parseInt($('input[name="convenio"]:checked').val()) || 0;
        var fechaAltaSisExt = $('#fechaAltaSisExterno').val() || '';
        var cuenta1 = $('#cuenta1').val() || '';
        var cuenta2 = $('#cuenta2').val() || '';
        var cuenta3 = $('#cuenta3').val() || '';
        var cuenta4 = $('#cuenta4').val() || '';
        var cuenta5 = $('#cuenta5').val() || '';
        var cuenta6 = $('#cuenta6').val() || '';
        var afectaLS = $('#afectaLS').val() || '';
        var operacionRef = $('#operacionRef').val() || '';
        var totalAux8 = parseFloat($('#totalAux8').val()) || 0;

        // Build PPL call with individual parameters
        var params = [
            '"' + esc(fechaOp) + '"',
            '"' + esc(fechaVto) + '"',
            '"' + esc(fechaPago) + '"',
            '"' + esc(especie) + '"',
            '"' + esc(contraEspecie) + '"',
            '"' + esc(cliente1) + '"',
            '"' + cantidad + '"',
            '"' + precio1 + '"',
            '"' + esc(corredor) + '"',
            '"' + esc(mercado4) + '"',
            '"' + esc(plataforma) + '"',
            '"' + esc(mercado) + '"',
            '"' + esc(mercado2) + '"',
            '"' + esc(book1) + '"',
            '"' + esc(vehiculo1) + '"',
            '"' + esc(tablaFeriados1) + '"',
            '"' + esc(nrExterno) + '"',
            '"' + esc(nrOrden1) + '"',
            '"' + esc(opSIOPEL) + '"',
            '"' + esc(observaciones) + '"',
            '"' + rb5 + '"',
            '"' + plazo + '"',
            '"' + formaLiq1 + '"',
            '"' + formaLiq2 + '"',
            '"' + rb6 + '"',
            '"' + rb9 + '"',
            '"' + cartera + '"',
            '"' + cb6 + '"',
            '"' + cb7 + '"',
            '"' + cb10 + '"',
            '"' + convenio + '"',
            '"' + esc(fechaAltaSisExt) + '"',
            '"' + esc(cuenta1) + '"',
            '"' + esc(cuenta2) + '"',
            '"' + esc(cuenta3) + '"',
            '"' + esc(cuenta4) + '"',
            '"' + esc(cuenta5) + '"',
            '"' + esc(cuenta6) + '"',
            '"' + esc(afectaLS) + '"',
            '"' + esc(operacionRef) + '"',
            '"' + totalAux8 + '"'
        ].join(', ');

        var call = 'CrearOperacionTIC(' + params + ')';

        console.log('TIC PPL Call: CrearOperacionTIC(...)');

        bound.execPPL(call).then(function(result) {
            $$.loading(false);
            $('#btn-crear').prop('disabled', false);

            var nrOp = extractValue(result, 'NrOperacion');
            console.log('TIC: Operacion creada:', nrOp);

            var notifData = {
                NrOperacion: nrOp,
                TipoOp: 'TIC',
                Especie: especie,
                ContraEspecie: contraEspecie,
                Cliente: cliente1,
                Cantidad: cantidad,
                Precio: precio1,
                Mercado: mercado,
                Book: book1,
                Vehiculo: vehiculo1
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
    // WebSocket - notify POSI4
    // ========================================================================
    function setupWebSocketConnection() {
        console.log('TIC: Conectando WS:', HUB_URL);

        hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(HUB_URL, { transport: signalR.HttpTransportType.WebSockets, withCredentials: true })
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
            .then(function() { console.log('TIC: Suscrito a POSI4'); })
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
        hubConnection.invoke('BroadcastToAll', 'POSI4', { action: action, timestamp: new Date().toISOString(), data: data })
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
            case 'connected': el.html('<span class="tic-ws-dot connected"></span> Conectado'); break;
            case 'reconnecting': el.html('<span class="tic-ws-dot"></span> Reconectando...'); break;
            default: el.html('<span class="tic-ws-dot error"></span> Desconectado');
        }
    }

    function formatMoney(value) {
        if (value === null || value === undefined || isNaN(value)) return '';
        return '$ ' + value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
    }

    function showToast(message, type) {
        type = type || 'info';
        var toast = $('<div class="tic-toast ' + type + '">' + message + '</div>');
        $('body').append(toast);
        setTimeout(function() { toast.fadeOut(300, function() { toast.remove(); }); }, 3000);
    }

    // ========================================================================
    // Cleanup
    // ========================================================================
    window.addEventListener('beforeunload', function() { if (hubConnection) hubConnection.stop(); });
    $(document).ready(function() { init(); });

})();
