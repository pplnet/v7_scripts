/* ============================================================================
   JavaScript: Posiciones y Resultados - POSI4
   ============================================================================
   Dashboard con filtros, graficos de valuacion y actualizacion en tiempo real
   via SignalR cuando llega una notificacion de alguno de los grupos de
   NOTIFICACION del ciclo de vida de una operacion (ALTA, EDICION, BAJA,
   AVANZA, RETROCEDE).
   ============================================================================ */

(function() {
    'use strict';

    var dataTable = null;
    var posicionesData = [];
    var hubConnection = null;
    var reconnectAttempts = 0;
    var refreshTimer = null;
    var MAX_RECONNECT_ATTEMPTS = 10;
    var RECONNECT_DELAY_MS = 3000;
    var REFRESH_DEBOUNCE_MS = 1200;   // agrupa rafagas de notificaciones en un solo refresh
    var chartUsd = null;
    var chartArp = null;

    var API_BASE_URL = window.API_BASE_URL || 'https://localhost:44300';
    var HUB_URL = API_BASE_URL + '/hubs/ppl';

    // Grupos de la seccion NOTIFICACION que ameritan refrescar los datos. Se
    // matchean EXACTO y son case-sensitive tanto en la suscripcion como en el
    // filtro: asi son los grupos de SignalR y asi los escribe el catalogo PPL.
    var NOTIFY_GROUPS = ['ALTA', 'EDICION', 'BAJA', 'AVANZA', 'RETROCEDE'];

    // ========================================================================
    // Key mapping
    // ========================================================================
    var keyMap = {
        // Posiciones — claves de corte (Vehiculo/Book) + datos
        'vehiculo': 'Vehiculo', 'Vehiculo': 'Vehiculo',
        'book': 'Book', 'Book': 'Book',
        'especie': 'Especie', 'Especie': 'Especie',
        'especienombre': 'EspecieNombre', 'EspecieNombre': 'EspecieNombre',
        'contraespecie': 'ContraEspecie', 'ContraEspecie': 'ContraEspecie',
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
    // Vehiculo y Book van ocultas: se muestran en las filas de corte que arma
    // renderGroups(), igual que los "Total Vehiculo"/"Total Book" del informe.
    var COL_VEHICULO = 1;
    var COL_BOOK = 2;

    var colsConfig = [
        { className: 'details-control', orderable: false, data: null, defaultContent: '' },
        { data: 'Vehiculo', title: 'Vehículo', visible: false },
        { data: 'Book', title: 'Book', visible: false },
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
        {
            data: 'PosInicial',
            title: 'Pos. Inicial',
            className: 'text-right',
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
            className: 'text-right',
            render: function(data, type) {
                return type === 'display' ? $$.numberFormat(data || 0, 0, false, false) : data;
            }
        },
        {
            data: 'Ventas',
            title: 'Ventas',
            className: 'text-right',
            render: function(data, type) {
                return type === 'display' ? $$.numberFormat(data || 0, 0, false, false) : data;
            }
        },
        {
            data: 'PosicionNeta',
            title: 'Posici\u00f3n Neta',
            className: 'text-right',
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
            className: 'text-right',
            render: function(data, type) {
                return type === 'display' ? $$.numberFormat(data || 0, 4, false, false) : data;
            }
        },
        {
            data: 'Valuacion',
            title: 'Valuaci\u00f3n',
            className: 'text-right',
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

        initDataTable();
        setupEventListeners();
        setupWebSocketConnection();

        // Los combos se cargan ANTES del primer load: el vehiculo por defecto
        // (VEHICULODE, igual que el informe) forma parte del filtro inicial, asi
        // que pedir los datos antes mostraria otro conjunto de filas.
        loadFilterOptions().then(loadInitialData, loadInitialData);

        console.log('POSI4: Inicializado');
    }

    // ========================================================================
    // Combos de filtro (vehiculo / book)
    // ========================================================================
    function loadFilterOptions() {
        return Promise.all([
            fillSelect('#filter-vehiculo', 'GetVehiculos()'),
            fillSelect('#filter-book', 'GetBooks()')
        ]).then(applyVehiculoDefault);
    }

    // Puebla un <select> desde una funcion PPL que devuelve Codigo/Descripcion.
    // Un fallo se loguea y deja el combo en "Todos" — un filtro que no carga no
    // debe impedir que la grilla muestre datos.
    function fillSelect(selector, call) {
        return bound.execPPL(call).then(function(result) {
            var rows = transformData(result);
            var $sel = $(selector);
            $sel.empty().append($('<option>').val('').text('Todos'));
            rows.forEach(function(r) {
                var cod = (r.Codigo || '').trim();
                if (!cod) return;
                var desc = (r.Descripcion || r.Nombre || '').trim();
                // .text() escapa: la descripcion viene de la BD, no se interpola HTML.
                $sel.append($('<option>').val(cod).text(desc ? cod + ' - ' + desc : cod));
            });
        }).catch(function(err) {
            console.error('POSI4: error cargando ' + call, err);
        });
    }

    // Vehiculo con el que arranca el filtro. El informe usa Var('VEHICULODE'); acá es una
    // constante por pedido explícito (STD). Los books arrancan en "Todos", igual que el
    // multiselect Lista1 vacío del informe.
    var DEFAULT_VEHICULO = 'STD';

    function applyVehiculoDefault() {
        // Solo se aplica si el codigo existe entre las opciones cargadas; si no, el select
        // quedaria con un value fantasma y filtraria por nada.
        var exists = false;
        $('#filter-vehiculo option').each(function() {
            if (this.value === DEFAULT_VEHICULO) exists = true;
        });
        if (exists) {
            $('#filter-vehiculo').val(DEFAULT_VEHICULO);
        } else {
            console.warn('POSI4: el vehiculo por defecto (' + DEFAULT_VEHICULO +
                         ') no existe en VEHICULOS; el filtro queda en Todos');
        }
    }


    // ========================================================================
    // Filter params
    // ========================================================================
    function getFilterParams() {
        var fecha = $('#filter-fecha').val() || new Date().toISOString().split('T')[0];
        var especie = ($('#filter-especie').val() || '').trim();
        var tipoEspecie = $('#filter-tipo-especie').val() || '';
        var vehiculo = $('#filter-vehiculo').val() || '';
        var book = $('#filter-book').val() || '';
        return {
            fecha: fecha,
            especie: especie,
            tipoEspecie: tipoEspecie,
            vehiculo: vehiculo,
            book: book
        };
    }

    function buildGetPosicionesCall(p) {
        return 'GetPosiciones("' + p.fecha + '", "' + p.especie + '", "' + p.tipoEspecie +
               '", "' + p.vehiculo + '", "' + p.book + '")';
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
            // ⚠️ NADA de `scrollX: true`. Partía la grilla en dos <table> (cabecera clonada
            // + cuerpo) y, como ambas usan table-layout:auto, cada una repartía el ancho
            // según SU propio contenido: la celda Especie del cuerpo se estiraba por el
            // nombre largo de la especie y la cabecera no, así que los títulos quedaban
            // desfasados respecto de los datos y era imposible alinearlos por CSS.
            // Con una sola tabla, cabecera y datos comparten columna por construcción; el
            // scroll horizontal lo da .posi4-table-card con overflow-x.
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
            // orderFixed mantiene el corte Vehiculo\u2192Book aunque el usuario ordene por otra
            // columna: sin esto, un click en "Especie" mezclar\u00eda los grupos y las filas de
            // corte quedar\u00edan mintiendo.
            orderFixed: [[COL_VEHICULO, 'asc'], [COL_BOOK, 'asc']],
            order: [[3, 'asc']],
            drawCallback: function() { renderGroups(this.api()); }
        });

        $$.setDataTable(dataTable, dtSelector);
        $$.setKeyNames(["Especie"]);
    }

    // ========================================================================
    // Cortes por Vehiculo / Book (equivalente a los "Total Book:" y "Total
    // Vehiculo" que el informe intercala cuando cambia fbn('Book')/fbn('Vehiculo'))
    // ========================================================================

    // Índices de columna de colsConfig (0 = details, 1-2 = Vehiculo/Book ocultas).
    var COL_ESPECIE = 3;
    var COL_POSINICIAL = 5;
    var COL_VALUACION = 10;

    function emptyAcc() {
        return { PosInicial: 0, Compras: 0, Ventas: 0, PosicionNeta: 0, Valuacion: 0 };
    }

    function addToAcc(acc, row) {
        acc.PosInicial += parseFloat(row.PosInicial) || 0;
        acc.Compras += parseFloat(row.Compras) || 0;
        acc.Ventas += parseFloat(row.Ventas) || 0;
        acc.PosicionNeta += parseFloat(row.PosicionNeta) || 0;
        acc.Valuacion += parseFloat(row.Valuacion) || 0;
        return acc;
    }

    function esc(value) {
        return $('<div>').text(value == null ? '' : String(value)).html();
    }

    /**
     * Arma una fila de corte con EXACTAMENTE una celda por columna visible, sin `colspan`.
     *
     * Con `table-layout: auto` el ancho de cada columna lo fija el contenido de TODAS sus
     * celdas, y una celda con `colspan` participa de varias a la vez: alcanza para correr las
     * columnas y desalinear los datos respecto de sus títulos. Emitir una celda por columna
     * mantiene la correspondencia 1:1.
     *
     * Se itera sobre las columnas REALES del DataTable (no sobre una lista paralela), así
     * agregar u ocultar una columna en colsConfig no puede desfasar los cortes.
     */
    function buildGroupRow(api, cls, cellHtmlFor) {
        var html = '<tr class="' + cls + '">';
        api.columns().every(function(idx) {
            if (!this.visible()) return;
            html += cellHtmlFor(idx);
        });
        return html + '</tr>';
    }

    function groupHeaderRow(api, label, cls) {
        return buildGroupRow(api, 'posi4-group ' + cls, function(idx) {
            return idx === COL_ESPECIE
                ? '<td class="posi4-group-label">' + esc(label) + '</td>'
                : '<td></td>';
        });
    }

    /**
     * Fila vacía que separa una sección de book de la anterior.
     *
     * ⚠️ Tiene que ser una FILA, no un `border-top` en la cabecera del book: la tabla usa
     * `border-collapse: collapse`, así que el borde inferior de una sección y el superior de
     * la siguiente se FUSIONAN en uno solo si las filas son adyacentes — y el pedido es que
     * cada sección tenga sus 4 bordes propios, sin compartir. La fila espaciadora, que no
     * tiene bordes, corta esa fusión.
     */
    function spacerRow(api) {
        return buildGroupRow(api, 'posi4-sec-gap', function() { return '<td></td>'; });
    }

    /**
     * Repite los títulos de las columnas dentro de cada Book. Los toma del <thead> REAL
     * (no de una lista paralela) para que no puedan quedar desfasados ni desactualizados.
     */
    function columnTitlesRow(api) {
        return buildGroupRow(api, 'posi4-group-titles posi4-sec', function(idx) {
            var title = $(api.column(idx).header()).text() || '';
            var align = idx >= COL_POSINICIAL ? ' text-right' : '';
            return '<td class="posi4-titles-cell' + align + '">' + esc(title) + '</td>';
        });
    }

    // Cada número cae bajo SU columna. Precio Fin queda vacío a propósito: es un precio,
    // no un acumulable.
    function subtotalRow(api, label, acc, cls) {
        var valores = {};
        valores[COL_POSINICIAL] = $$.numberFormat(acc.PosInicial, 0, false, false);
        valores[COL_POSINICIAL + 1] = $$.numberFormat(acc.Compras, 0, false, false);
        valores[COL_POSINICIAL + 2] = $$.numberFormat(acc.Ventas, 0, false, false);
        valores[COL_POSINICIAL + 3] = $$.numberFormat(acc.PosicionNeta, 0, false, false);
        valores[COL_VALUACION] = $$.numberFormat(acc.Valuacion, 2, false, false);

        return buildGroupRow(api, 'posi4-subtotal ' + cls, function(idx) {
            if (idx === COL_ESPECIE) {
                return '<td class="posi4-subtotal-label">' + esc(label) + '</td>';
            }
            return valores[idx] !== undefined
                ? '<td class="text-right">' + valores[idx] + '</td>'
                : '<td></td>';
        });
    }

    // ⚠️ Los subtotales se calculan sobre la PÁGINA VISIBLE, así que un grupo que se parte
    // entre dos páginas rinde un subtotal PARCIAL en cada una (comportamiento estándar de
    // agrupar en DataTables; el informe no pagina y ahí el corte siempre es único).
    // Se detecta comparando los bordes de la página contra el dataset completo ordenado, y
    // se avisa de dos formas: marcando la fila de subtotal y mostrando el cartel de arriba.
    var PARCIAL_SIGUE = ' — PARCIAL, sigue en la página siguiente';
    var PARCIAL_VIENE = ' — viene de la página anterior';

    function vehKey(d) { return (d && d.Vehiculo) || ''; }
    function bookKey(d) { return vehKey(d) + ' ' + ((d && d.Book) || ''); }

    function updateSplitWarning(hayCorteDividido) {
        var $w = $('#group-split-warning');
        if ($w.length) $w.toggle(!!hayCorteDividido);
    }

    /**
     * Intercala las filas de corte sobre la página visible. Se llama desde drawCallback,
     * así que corre en cada draw (orden, búsqueda, paginado) sobre las filas ya ordenadas.
     */
    function renderGroups(api) {
        var rowsQuery = api.rows({ page: 'current', search: 'applied', order: 'applied' });
        var nodes = rowsQuery.nodes();
        var data = rowsQuery.data();
        if (!data || data.length === 0) {
            updateSplitWarning(false);
            return;
        }

        // Dataset completo (mismo filtro y orden, sin paginar) para mirar qué hay del otro
        // lado de los bordes de la página.
        var all = api.rows({ search: 'applied', order: 'applied' }).data();
        var info = api.page.info();
        var primero = data[0] || {};
        var ultimo = data[data.length - 1] || {};

        var bookViene = info.start > 0 && bookKey(all[info.start - 1]) === bookKey(primero);
        var bookSigue = info.end < all.length && bookKey(all[info.end]) === bookKey(ultimo);
        var vehViene = info.start > 0 && vehKey(all[info.start - 1]) === vehKey(primero);
        var vehSigue = info.end < all.length && vehKey(all[info.end]) === vehKey(ultimo);

        updateSplitWarning(bookViene || bookSigue || vehViene || vehSigue);

        var lastVeh = null, lastBook = null;
        var bookAcc = emptyAcc(), vehAcc = emptyAcc();

        for (var i = 0; i < data.length; i++) {
            var d = data[i] || {};
            var veh = d.Vehiculo || '';
            var book = d.Book || '';
            var $row = $(nodes).eq(i);
            var esPrimera = (i === 0);

            // Cierre de los grupos abiertos (book primero, después vehiculo). El Total Book
            // es la última fila de la sección: lleva el borde inferior del bloque.
            if (lastBook !== null && (veh !== lastVeh || book !== lastBook)) {
                $row.before(subtotalRow(api, 'Total Book: ' + lastBook, bookAcc,
                    'posi4-subtotal-book posi4-sec posi4-sec-bottom'));
                bookAcc = emptyAcc();
            }
            if (lastVeh !== null && veh !== lastVeh) {
                // Aire también acá: el borde de 2px del total de vehículo, al colapsar contra
                // la fila de arriba, se comería el borde inferior de la última caja de book.
                $row.before(spacerRow(api));
                $row.before(subtotalRow(api, 'Total Vehículo: ' + lastVeh, vehAcc, 'posi4-subtotal-veh'));
                vehAcc = emptyAcc();
            }

            // Apertura de los grupos nuevos. La cabecera de la primera fila de la página
            // avisa si ese grupo ya venía abierto de la página anterior.
            var abreVehiculo = (veh !== lastVeh);
            if (abreVehiculo) {
                $row.before(groupHeaderRow(api,
                    'VEHÍCULO: ' + (veh || '(sin vehículo)') + (esPrimera && vehViene ? PARCIAL_VIENE : ''),
                    'posi4-group-veh' + (esPrimera && vehViene ? ' posi4-group-parcial' : '')));
            }
            if (abreVehiculo || book !== lastBook) {
                // Aire respecto de la tabla del book anterior. NO va en el primer book de cada
                // vehículo: ahí el separador es el propio banner del vehículo, y además no hay
                // "book anterior" del que separarse.
                if (!abreVehiculo) $row.before(spacerRow(api));

                // La cabecera del book es la primera fila de la sección: lleva el borde
                // superior del bloque.
                $row.before(groupHeaderRow(api,
                    'Book: ' + (book || '(sin book)') + (esPrimera && bookViene ? PARCIAL_VIENE : ''),
                    'posi4-group-book posi4-sec posi4-sec-top' +
                    (esPrimera && bookViene ? ' posi4-group-parcial' : '')));
                // Los títulos se repiten en cada book: con el corte de por medio, la
                // cabecera del DataTable queda lejos y no se sabe qué columna es cuál.
                $row.before(columnTitlesRow(api));
            }

            // Las filas de datos también son parte de la sección (bordes laterales del bloque).
            $row.addClass('posi4-sec');

            addToAcc(bookAcc, d);
            addToAcc(vehAcc, d);
            lastVeh = veh;
            lastBook = book;
        }

        // Cierre del último grupo. El orden de los .after() es inverso al visual:
        // el segundo insertado queda pegado a la fila, así que el vehiculo va primero.
        var $lastRow = $(nodes).eq(data.length - 1);
        $lastRow.after(subtotalRow(api,
            'Total Vehículo: ' + lastVeh + (vehSigue ? PARCIAL_SIGUE : ''),
            vehAcc, 'posi4-subtotal-veh' + (vehSigue ? ' posi4-subtotal-parcial' : '')));
        $lastRow.after(spacerRow(api));
        $lastRow.after(subtotalRow(api,
            'Total Book: ' + lastBook + (bookSigue ? PARCIAL_SIGUE : ''),
            bookAcc, 'posi4-subtotal-book posi4-sec posi4-sec-bottom' +
            (bookSigue ? ' posi4-subtotal-parcial' : '')));
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

        // El detalle se acota al vehiculo/book DE LA FILA, no al del filtro: ahora cada fila
        // es un (Vehiculo, Book, Especie), así que las operaciones que la componen son las
        // de ese corte. Con el filtro en "Todos" mostraría operaciones de otros books.
        var p = getFilterParams();
        var call = 'GetResultados("' + (posData.Especie || '') + '", "' + p.fecha +
                   '", "' + (posData.Vehiculo || '') + '", "' + (posData.Book || '') + '")';

        bound.execPPL(call).then(function(result) {
            var ops = transformData(result);

            var html = '<table class="table table-sm mb-0 posi4-detail-table" style="font-size:12px">';
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

    // Decide si un evento SignalR amerita refrescar los datos. El messageCode de
    // una notificacion PPL ES el nombre del grupo emisor.
    function isOperationEvent(messageCode) {
        return NOTIFY_GROUPS.indexOf(String(messageCode || '')) !== -1;
    }

    function scheduleRefresh() {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refreshData, REFRESH_DEBOUNCE_MS);
    }

    function setupHubEventHandlers() {
        hubConnection.on('ReceiveMessage', function(messageCode, payload) {
            console.log('POSI4: Mensaje recibido:', messageCode, payload);
            if (isOperationEvent(messageCode)) scheduleRefresh();
        });

        hubConnection.onreconnecting(function() { updateWsStatus('reconnecting'); });
        hubConnection.onreconnected(function() {
            reconnectAttempts = 0;
            updateWsStatus('connected');
            // La membresia de grupo de SignalR es por connectionId: al reconectar
            // hay que volver a suscribirse antes de refrescar.
            subscribeAll();
            scheduleRefresh();
        });
        hubConnection.onclose(function() {
            updateWsStatus('disconnected');
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                setTimeout(startConnection, RECONNECT_DELAY_MS * reconnectAttempts);
            }
        });
    }

    function subscribeAll() {
        return hubConnection.invoke('SubscribeMany', NOTIFY_GROUPS)
            .catch(function(err) { console.error('Error suscribiendo a los grupos de notificacion:', err); });
    }

    function startConnection() {
        hubConnection.start()
            .then(function() {
                reconnectAttempts = 0;
                updateWsStatus('connected');
                return subscribeAll();
            })
            .then(function() {
                console.log('POSI4: Suscrito a', NOTIFY_GROUPS.join(', '));
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
