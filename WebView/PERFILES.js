/* ============================================================================
   JavaScript: Perfiles de Usuario
   ============================================================================
   Logica de interactividad y comunicacion con backend PPL para Alta, Baja
   y Modificacion de Perfiles de Usuario del sistema.
   Incluye 14 tabs de permisos con datos cargados desde la BD y generacion de script.
   ============================================================================ */

// Namespace global para funciones llamadas desde onclick del HTML
var PERFILES = {};

(function() {
    'use strict';

    // ========================================================================
    // Variables globales
    // ========================================================================
    var dataTable = null;       // DataTable de la grilla principal
    var perfilesData = [];      // Lista de perfiles cargados del backend
    var selectedRow = null;
    var selectedData = null;
    var formMode = null;        // 'alta', 'modificacion', 'visualizacion'
    var currentPerfilIndex = -1;

    // Object Storage (permisos de directorio por perfil). API_BASE_URL lo reescribe el
    // frontend antes de montar el iframe (ver CLAUDE.md de v7_back); el default local
    // es solo un fallback de desarrollo.
    var API_BASE_URL = window.API_BASE_URL || 'https://localhost:44300';
    var STORAGE_URL  = API_BASE_URL + '/storage';
    var dirAdmin = false;                  // flag DIF (admin del filesystem, escalar por perfil)
    var storageRootsAccessible = true;     // false si GET /storage/roots devolvio 403/error

    // DataTables de las tabs de permisos
    var tabDataTables = {};

    // Estado de los permisos (arrays editables, copiados de los datos base)
    var permData = {
        menu: [],
        tablas: [],
        tiposop: [],
        tipostr: [],
        tiposord: [],
        informes: [],
        eventos: [],
        especiales: [],
        variables: [],
        instancias: [],
        webviews: [],
        canales: [],
        directorios: []
    };

    // ========================================================================
    // DATOS DE PERMISOS (cargados dinamicamente desde la BD)
    // ========================================================================

    // Cargados dinamicamente via bound.execPPL() en loadBaseData()
    var BASE_ITEMS_MENU = [];
    var BASE_TABLAS_ABM = [];
    var BASE_TIPOS_OPERACION = [];

    // Cargado dinamicamente desde ppl_deploy (scripts de tipo Transaccion)
    var BASE_TIPOS_TRANSACCION = [];

    var BASE_TIPOS_ORDEN = [];
    var BASE_INFORMES = [];
    var BASE_EVENTOS = [];

    // HARDCODED: permisos especiales fijos (no tienen tabla en BD)
    var BASE_ESPECIALES = [
        { codigo: "EX001", nombre: "Procesar movimientos automaticos", hab: false },
        { codigo: "EX003", nombre: "Abrir dia", hab: false },
        { codigo: "EX005", nombre: "Cerrar dia", hab: false },
        { codigo: "EX006", nombre: "Modificar fecha menor (Abrir dia)", hab: false },
        { codigo: "EX007", nombre: "Modificar fecha (Abrir dia)", hab: false },
        { codigo: "EX011", nombre: "Modificar jerarquia (Clientes, Especies, etc.)", hab: false },
        { codigo: "EX013", nombre: "Ingresar al sistema con dia cerrado", hab: false },
        { codigo: "EX014", nombre: "Realizar operaciones con dia cerrado", hab: false },
        { codigo: "EX015", nombre: "Realizar transacciones con dia cerrado", hab: false },
        { codigo: "EX016", nombre: "Ver operaciones eventuales de todos", hab: false },
        { codigo: "EX017", nombre: "Boton de carga de operacion", hab: false },
        { codigo: "EX018", nombre: "Confirmar operacion eventual", hab: false },
        { codigo: "EX019", nombre: "Habilitar filtro de TasasVehiculo/CierreBNA", hab: false },
        { codigo: "EX020", nombre: "Pasar de instancia operaciones sin permiso al TipoOp", hab: false },
        { codigo: "OPFVALOR", nombre: "Cargar operaciones fecha valor", hab: false },
        { codigo: "CARGAOPS", nombre: "Cargar operaciones con carga deshabilitada", hab: false }
    ];

    var BASE_VARIABLES = [];
    var BASE_INSTANCIAS = [];
    var BASE_WEBVIEWS = [];
    var BASE_CANALES = [];
    var BASE_DIRECTORIOS = [];

    // Flag para cargar datos base una sola vez por sesion
    var baseDataLoaded = false;

    // ========================================================================
    // Transformador de datos del backend
    // ========================================================================
    function transformRow(row) {
        if (!row || !Array.isArray(row)) return row;
        var obj = {};
        row.forEach(function(item) {
            if (item && item.key !== undefined) {
                var key = capitalizeKey(item.key);
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
                var obj = {};
                Object.keys(row).forEach(function(key) {
                    var newKey = capitalizeKey(key);
                    obj[newKey] = typeof row[key] === 'string' ? row[key].trim() : row[key];
                });
                return obj;
            }
            return row;
        });
    }

    function capitalizeKey(key) {
        if (!key) return key;
        var keyMap = {
            'codigo': 'Codigo',
            'nombre': 'Nombre',
            'script': 'Script',
            'menu': 'Menu',
            'tipo': 'Tipo',
            'acceso': 'Acceso',
            'submenu': 'SubMenu',
            'descripcion': 'Descripcion',
            'tabla': 'Tabla',
            'nrinstancia': 'NrInstancia',
            'id': 'Id'
        };
        var lowerKey = key.toLowerCase();
        if (keyMap[lowerKey]) return keyMap[lowerKey];
        return key.charAt(0).toUpperCase() + key.slice(1);
    }

    // ========================================================================
    // Deep clone de arrays de objetos
    // ========================================================================
    function cloneArray(arr) {
        return JSON.parse(JSON.stringify(arr));
    }

    // ========================================================================
    // Carga dinamica de datos base desde la BD
    // ========================================================================

    function loadBaseData() {
        if (baseDataLoaded) {
            return Promise.resolve();
        }

        return Promise.all([
            loadMenuItems(),
            loadTablasAbm(),
            loadTiposOperacion(),
            loadTiposTransaccion(),
            loadTiposOrden(),
            loadInformes(),
            loadEventos(),
            loadVariables(),
            loadInstancias(),
            loadWebViews(),
            loadCanales(),
            loadStorageRoots()
        ]).then(function() {
            baseDataLoaded = true;
            console.log('Datos base cargados desde la BD');
        }).catch(function(error) {
            console.error('Error cargando datos base:', error);
        });
    }

    function loadMenuItems() {
        return bound.execPPL("GetItemsMenu()").then(function(result) {
            var rows = transformData(result);
            BASE_ITEMS_MENU = rows.map(function(r) {
                return {
                    subMenu: (r.SubMenu || r.Descripcion || '').trim() || 'General',
                    item: (r.Nombre || '').trim(),
                    codMenu: (r.Menu || '').trim(),
                    ver: false
                };
            });
            console.log('Items menu cargados:', BASE_ITEMS_MENU.length);
        }).catch(function(e) {
            console.warn('Error cargando items menu:', e);
            BASE_ITEMS_MENU = [];
        });
    }

    function loadTablasAbm() {
        return bound.execPPL("GetTablasAbm()").then(function(result) {
            var rows = transformData(result);
            BASE_TABLAS_ABM = rows.map(function(r) {
                return {
                    nombre: (r.Nombre || '').trim(),
                    codAbm: (r.Codigo || '').trim(),
                    prefijo: (r.Acceso || '').trim(),
                    alta: false, baja: false, modificacion: false, ver: false, doble: false
                };
            });

            // Agregar entradas hardcodeadas que no estan en la tabla ABMS
            var hardcoded = [
                { nombre: "Operaciones", codAbm: "__OP", prefijo: "OP" },
                { nombre: "Op. Minoristas", codAbm: "__OM", prefijo: "OM" },
                { nombre: "Op. Eventuales", codAbm: "__OE", prefijo: "OE" },
                { nombre: "Transacciones", codAbm: "__T3", prefijo: "T3" },
                { nombre: "Ordenes", codAbm: "__OR", prefijo: "OR" },
                { nombre: "Minutas Bolsa", codAbm: "__MI", prefijo: "MI" }
            ];

            hardcoded.forEach(function(hc) {
                var exists = BASE_TABLAS_ABM.some(function(t) {
                    return t.prefijo === hc.prefijo;
                });
                if (!exists) {
                    BASE_TABLAS_ABM.push({
                        nombre: hc.nombre, codAbm: hc.codAbm, prefijo: hc.prefijo,
                        alta: false, baja: false, modificacion: false, ver: false, doble: false
                    });
                }
            });

            console.log('Tablas ABM cargadas:', BASE_TABLAS_ABM.length);
        }).catch(function(e) {
            console.warn('Error cargando tablas ABM:', e);
            BASE_TABLAS_ABM = [];
        });
    }

    function loadTiposOperacion() {
        return bound.execPPL("GetTiposOperacion()").then(function(result) {
            var rows = transformData(result);
            BASE_TIPOS_OPERACION = rows.map(function(r) {
                return { codigo: (r.Codigo || '').trim(), nombre: (r.Nombre || '').trim(), hab: false };
            });
            console.log('Tipos operacion cargados:', BASE_TIPOS_OPERACION.length);
        }).catch(function(e) {
            console.warn('Error cargando tipos operacion:', e);
            BASE_TIPOS_OPERACION = [];
        });
    }

    function loadTiposTransaccion() {
        return bound.execPPL("GetTiposTransaccion()").then(function(result) {
            var rows = transformData(result);
            BASE_TIPOS_TRANSACCION = rows.map(function(r) {
                return { codigo: (r.Codigo || '').trim(), nombre: (r.Nombre || '').trim(), hab: false };
            });
            console.log('Tipos transaccion cargados:', BASE_TIPOS_TRANSACCION.length);
        }).catch(function(e) {
            console.warn('Error cargando tipos transaccion:', e);
            BASE_TIPOS_TRANSACCION = [];
        });
    }

    function loadTiposOrden() {
        return bound.execPPL("GetTiposOrden()").then(function(result) {
            var rows = transformData(result);
            BASE_TIPOS_ORDEN = rows.map(function(r) {
                return { codigo: (r.Codigo || '').trim(), nombre: (r.Nombre || '').trim(), hab: false };
            });
            console.log('Tipos orden cargados:', BASE_TIPOS_ORDEN.length);
        }).catch(function(e) {
            console.warn('Error cargando tipos orden:', e);
            BASE_TIPOS_ORDEN = [];
        });
    }

    function loadInformes() {
        return bound.execPPL("GetInformes()").then(function(result) {
            var rows = transformData(result);
            BASE_INFORMES = rows.map(function(r) {
                return {
                    codigo: (r.Codigo || '').trim(),
                    nombre: (r.Nombre || '').trim(),
                    tipo: (r.Tipo || '').trim(),
                    hab: false
                };
            });
            console.log('Informes cargados:', BASE_INFORMES.length);
        }).catch(function(e) {
            console.warn('Error cargando informes:', e);
            BASE_INFORMES = [];
        });
    }

    function loadEventos() {
        return bound.execPPL("GetEventos()").then(function(result) {
            var rows = transformData(result);
            BASE_EVENTOS = rows.map(function(r) {
                return {
                    codigo: (r.Codigo || '').trim(),
                    nombre: (r.Nombre || '').trim(),
                    tipo: (r.Tipo || '').trim(),
                    hab: false
                };
            });
            console.log('Eventos cargados:', BASE_EVENTOS.length);
        }).catch(function(e) {
            console.warn('Error cargando eventos:', e);
            BASE_EVENTOS = [];
        });
    }

    function loadVariables() {
        return bound.execPPL("GetVariables()").then(function(result) {
            var rows = transformData(result);
            BASE_VARIABLES = rows.map(function(r) {
                return { codigo: (r.Codigo || '').trim(), nombre: (r.Nombre || '').trim(), hab: false };
            });
            console.log('Variables cargadas:', BASE_VARIABLES.length);
        }).catch(function(e) {
            console.warn('Error cargando variables:', e);
            BASE_VARIABLES = [];
        });
    }

    function loadInstancias() {
        return bound.execPPL("GetInstancias()").then(function(result) {
            var rows = transformData(result);
            BASE_INSTANCIAS = rows.map(function(r) {
                return {
                    tabla: (r.Tabla || '').trim(),
                    nrInstancia: String(r.NrInstancia || r.Nrinstancia || ''),
                    nombre: (r.Nombre || '').trim(),
                    alta: false, baja: false, modificacion: false, avanzar: false, retroceder: false
                };
            });
            console.log('Instancias cargadas:', BASE_INSTANCIAS.length);
        }).catch(function(e) {
            console.warn('Error cargando instancias:', e);
            BASE_INSTANCIAS = [];
        });
    }

    function loadWebViews() {
        return bound.execPPL("GetWebViews()").then(function(result) {
            var rows = transformData(result);
            BASE_WEBVIEWS = rows.map(function(r) {
                return {
                    codigo: (r.Codigo || '').trim(),
                    nombre: (r.Nombre || '').trim(),
                    tipo: (r.Tipo || '').trim(),
                    hab: false
                };
            });
            console.log('WebViews cargados:', BASE_WEBVIEWS.length);
        }).catch(function(e) {
            console.warn('Error cargando webviews:', e);
            BASE_WEBVIEWS = [];
        });
    }

    function loadCanales() {
        return bound.execPPL("GetCanales()").then(function(result) {
            var rows = transformData(result);
            BASE_CANALES = rows.map(function(r) {
                return {
                    id: String(r.Id || '').trim(),
                    nombre: (r.Nombre || '').trim(),
                    descripcion: (r.Descripcion || '').trim(),
                    permiso: 'restringido'
                };
            });
            console.log('Canales cargados:', BASE_CANALES.length);
        }).catch(function(e) {
            console.warn('Error cargando canales:', e);
            BASE_CANALES = [];
        });
    }

    // ========================================================================
    // Directorios raiz del object storage (SeaweedFS)
    // ------------------------------------------------------------------------
    // Salen del endpoint REST GET /storage/roots (admin-only), NO de una funcion PPL.
    // Un 403 (el editor del perfil no es admin del filesystem) o cualquier error deja
    // la lista vacia y marca 'sin permiso'; igual se veran los directorios ya asignados
    // en el Script del perfil (ver parseScript, que mergea ambos). La cookie de sesion
    // viaja con credentials:'include'. NO pasa por transformData/capitalizeKey: el
    // endpoint devuelve un string[] plano.
    // ========================================================================
    function loadStorageRoots() {
        storageRootsAccessible = true;
        return fetch(STORAGE_URL + '/roots', { credentials: 'include' })
            .then(function(resp) {
                if (!resp.ok) {
                    storageRootsAccessible = false;
                    BASE_DIRECTORIOS = [];
                    console.warn('No se pudo listar /storage/roots (status ' + resp.status + ')');
                    return null;
                }
                return resp.json();
            })
            .then(function(roots) {
                if (roots === null) return;
                BASE_DIRECTORIOS = (roots || []).map(function(name) {
                    return { dir: String(name || '').trim(), permiso: 'ninguno' };
                }).filter(function(d) { return d.dir.length > 0; });
                console.log('Directorios raiz cargados:', BASE_DIRECTORIOS.length);
            })
            .catch(function(e) {
                storageRootsAccessible = false;
                BASE_DIRECTORIOS = [];
                console.warn('Error cargando directorios raiz:', e);
            });
    }

    // ========================================================================
    // Canales del perfil (tabla MENSAJES_CANALES_PERFIL)
    // ------------------------------------------------------------------------
    // Modo 0 = Restringido, 2 = Asignado. El 1 (Opcional) es historico: se
    // muestra como Asignado y al guardar se reescribe como 2.
    //
    // Si el perfil NO tiene ninguna fila, el backend lo interpreta como "sin
    // permisos configurados" y hoy le permite TODOS los canales. Para no
    // restringirlo en silencio cuando alguien abre el perfil y confirma sin
    // tocar esta pestania, en ese caso se precarga todo como Asignado (o, si el
    // script todavia tiene los tokens legacy #{id}_OB / #{id}_OP, lo que digan
    // esos tokens). Un perfil nuevo (alta) arranca todo Restringido.
    // ========================================================================
    function loadCanalesPerfil(codigo, scriptStr) {
        return bound.execPPL("GetCanalesPerfil('" + codigo + "')").then(function(result) {
            var rows = transformData(result);
            var modos = {};
            var tieneFilas = false;

            rows.forEach(function(r) {
                var id = String(r.Id !== undefined && r.Id !== null ? r.Id : '').trim();
                if (!id) return;
                modos[id] = parseInt(r.Modo, 10) || 0;
                tieneFilas = true;
            });

            if (!tieneFilas) {
                applyCanalesFallback(scriptStr);
                return;
            }

            permData.canales.forEach(function(c) {
                // Sin fila para el canal = Restringido (mismo criterio que ProfileService).
                c.permiso = (modos[c.id] > 0) ? 'asignado' : 'restringido';
            });
        }).catch(function(e) {
            console.warn('Error cargando canales del perfil:', e);
            applyCanalesFallback(scriptStr);
        });
    }

    function applyCanalesFallback(scriptStr) {
        var siglaSet = {};
        var tieneTokens = false;

        (scriptStr || '').trim().split(/\s+/).forEach(function(s) {
            if (s) siglaSet[s.toUpperCase()] = true;
        });

        permData.canales.forEach(function(c) {
            // Tokens legacy: #{id}_OB (obligatorio) / #{id}_OP (opcional) -> ambos Asignado.
            if (siglaSet['#' + c.id + '_OB'] || siglaSet['#' + c.id + '_OP']) {
                c.permiso = 'asignado';
                tieneTokens = true;
            } else {
                c.permiso = 'restringido';
            }
        });

        if (!tieneTokens) {
            // Ni filas ni tokens: el perfil hoy ve todos los canales -> no cambiarlo en silencio.
            permData.canales.forEach(function(c) { c.permiso = 'asignado'; });
        }
    }

    function getCanalesAsignados() {
        return permData.canales
            .filter(function(c) { return c.permiso === 'asignado'; })
            .map(function(c) { return parseInt(c.id, 10); })
            .filter(function(id) { return !isNaN(id); })
            .join(',');
    }

    // ========================================================================
    // Inicializacion
    // ========================================================================
    function init() {
        console.log('Inicializando WebView Perfiles de Usuario...');

        initMainDataTable();
        loadPerfiles();
        setupEventListeners();

        console.log('WebView inicializada correctamente');
    }

    // ========================================================================
    // DataTable principal (grilla de perfiles)
    // ========================================================================
    var mainColsConfig = [
        { "data": "Codigo", "title": "Código" },
        { "data": "Nombre", "title": "Nombre" }
    ];

    function initMainDataTable() {
        dataTable = $('#dt1').DataTable({
            scrollX: true,
            searching: true,
            lengthChange: true,
            pageLength: 25,
            data: perfilesData,
            columns: mainColsConfig,
            language: {
                zeroRecords: "No se encontraron perfiles",
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
            order: [[0, 'asc']]
        });

        $$.setDataTable(dataTable, '#dt1');
        $$.setKeyNames(["Codigo"]);

        console.log('DataTable principal inicializada');
    }

    // ========================================================================
    // Cargar perfiles desde PPL
    // ========================================================================
    function loadPerfiles() {
        $$.loading(true);

        bound.execPPL("GetPerfiles()").then(function(result) {
            perfilesData = transformData(result);
            console.log('Perfiles cargados:', perfilesData.length);

            if (dataTable) {
                $$.setData(perfilesData, mainColsConfig);
            }

            $$.loading(false);
            clearSelection();
        }).catch(function(error) {
            $$.loading(false);
            console.error('Error cargando perfiles:', error);
            showError('Error al cargar los perfiles');
        });
    }

    // ========================================================================
    // Event Listeners
    // ========================================================================
    function setupEventListeners() {
        // --- Grilla: seleccion de fila ---
        $('#dt1 tbody').on('click', 'tr', function() {
            if (selectedRow) {
                $(selectedRow).removeClass('selected');
            }
            $(this).addClass('selected');
            selectedRow = this;
            selectedData = dataTable.row(this).data();
        });

        // --- Grilla: doble click abre modificacion ---
        $('#dt1 tbody').on('dblclick', 'tr', function() {
            var row = dataTable.row(this);
            if (row.data()) {
                selectedData = row.data();
                showForm('modificacion', selectedData);
            }
        });

        // --- Filtro propio ---
        $('#input-filtro').on('keyup', function() {
            dataTable.search($(this).val()).draw();
        });

        // --- Botones toolbar grilla ---
        $('#btn-alta').on('click', function() {
            showForm('alta', null);
        });

        $('#btn-baja').on('click', function() {
            if (!selectedData) {
                showNotification('Seleccione un perfil para dar de baja', 'warning');
                return;
            }
            $('#delete-codigo').text(selectedData.Codigo);
            $('#modalDelete').modal('show');
        });

        $('#btn-modificacion').on('click', function() {
            if (!selectedData) {
                showNotification('Seleccione un perfil para modificar', 'warning');
                return;
            }
            showForm('modificacion', selectedData);
        });

        $('#btn-visualizacion').on('click', function() {
            if (!selectedData) {
                showNotification('Seleccione un perfil para visualizar', 'warning');
                return;
            }
            showForm('visualizacion', selectedData);
        });

        $('#btn-actualizar').on('click', function() {
            loadPerfiles();
            showNotification('Datos actualizados correctamente', 'success');
        });

        // --- Botones toolbar formulario ---
        $('#btn-confirmar').on('click', function() {
            submitForm();
        });

        $('#btn-cancelar').on('click', function() {
            showGrid();
        });

        $('#btn-volver').on('click', function() {
            showGrid();
        });

        // --- Navegacion entre perfiles ---
        $('#btn-anterior').on('click', function() {
            navigatePerfil(-1);
        });

        $('#btn-siguiente').on('click', function() {
            navigatePerfil(1);
        });

        // --- Modal: confirmar eliminacion ---
        $('#btn-confirm-delete').on('click', function() {
            deletePerfil();
        });

        // --- Tab change: actualizar script cuando se muestra ---
        $('a[data-toggle="tab"]').on('shown.bs.tab', function(e) {
            var target = $(e.target).attr('href');

            // Redimensionar DataTables al cambiar tab (fix para columnas)
            if (tabDataTables[target]) {
                tabDataTables[target].columns.adjust();
            }

            // Actualizar script cuando se cambia a esa tab
            if (target === '#tab-script') {
                updateScriptOutput();
            }
        });

        // --- Filtros de tabs ---
        setupTabFilters();

        // --- Busqueda en tabs ---
        setupTabSearch();
    }

    // ========================================================================
    // Filtros de tabs de permisos
    // ========================================================================
    function setupTabFilters() {
        $('#filter-menu').on('change', function() {
            var val = $(this).val();
            if (tabDataTables['#tab-menu']) {
                tabDataTables['#tab-menu'].column(0).search(val).draw();
            }
        });

        $('#filter-tablas').on('change', function() {
            var val = $(this).val();
            if (tabDataTables['#tab-tablas']) {
                if (val === 'sistema') {
                    tabDataTables['#tab-tablas'].column(1).search('^__', true, false).draw();
                } else if (val === 'custom') {
                    tabDataTables['#tab-tablas'].column(1).search('^(?!__)', true, false).draw();
                } else {
                    tabDataTables['#tab-tablas'].column(1).search('').draw();
                }
            }
        });

        $('#filter-informes').on('change', function() {
            var val = $(this).val();
            if (tabDataTables['#tab-informes']) {
                tabDataTables['#tab-informes'].column(2).search(val).draw();
            }
        });

        $('#filter-eventos').on('change', function() {
            var val = $(this).val();
            if (tabDataTables['#tab-eventos']) {
                tabDataTables['#tab-eventos'].column(2).search(val).draw();
            }
        });

        $('#filter-instancias').on('change', function() {
            var val = $(this).val();
            if (tabDataTables['#tab-instancias']) {
                tabDataTables['#tab-instancias'].column(0).search(val).draw();
            }
        });
    }

    // ========================================================================
    // Busqueda en tabs de permisos
    // ========================================================================
    function setupTabSearch() {
        var searchMap = {
            'search-menu': '#tab-menu',
            'search-tablas': '#tab-tablas',
            'search-tiposop': '#tab-tiposop',
            'search-tipostr': '#tab-tipostr',
            'search-tiposord': '#tab-tiposord',
            'search-informes': '#tab-informes',
            'search-eventos': '#tab-eventos',
            'search-especiales': '#tab-especiales',
            'search-variables': '#tab-variables',
            'search-instancias': '#tab-instancias',
            'search-webviews': '#tab-webviews',
            'search-canales': '#tab-canales',
            'search-directorios': '#tab-directorios'
        };

        Object.keys(searchMap).forEach(function(searchId) {
            var tabKey = searchMap[searchId];
            $('#' + searchId).on('keyup', function() {
                if (tabDataTables[tabKey]) {
                    tabDataTables[tabKey].search($(this).val()).draw();
                }
            });
        });
    }

    // ========================================================================
    // Navegacion entre vistas
    // ========================================================================
    function showGrid() {
        formMode = null;
        clearForm();
        destroyTabDataTables();
        $('#view-form').hide();
        $('#view-grid').show();
    }

    function showForm(mode, data) {
        formMode = mode;
        $$.loading(true);

        // Cargar datos base desde la BD antes de mostrar el formulario
        loadBaseData().then(function() {
            resetPermissions();
            clearForm();

            // Titulo e icono segun modo
            var titles = {
                'alta': 'Perfiles - Alta',
                'modificacion': 'Perfiles - Modificación',
                'visualizacion': 'Perfiles - Visualización'
            };
            var icons = {
                'alta': 'fas fa-plus-circle',
                'modificacion': 'fas fa-pencil-alt',
                'visualizacion': 'fas fa-eye'
            };

            $('#form-title').text(titles[mode] || 'Perfiles');
            $('#form-icon').attr('class', icons[mode] || 'fas fa-id-badge');

            // Encontrar indice actual para navegacion
            if (data) {
                currentPerfilIndex = perfilesData.findIndex(function(p) {
                    return p.Codigo === data.Codigo;
                });
            } else {
                currentPerfilIndex = -1;
            }
            updateNavButtons();

            // Configurar campos segun modo
            if (mode === 'alta') {
                $('#fld-codigo').prop('readonly', false).removeClass('fld-readonly-pk');
            } else {
                $('#fld-codigo').prop('readonly', true).addClass('fld-readonly-pk');
            }

            if (mode === 'visualizacion') {
                $('#fld-codigo').prop('readonly', true);
                $('#fld-nombre').prop('readonly', true);
                $('#btn-confirmar').hide();
            } else {
                $('#fld-nombre').prop('readonly', false);
                $('#btn-confirmar').show();
            }

            // Mostrar vista formulario
            $('#view-grid').hide();
            $('#view-form').show();

            // Activar primer tab
            $('#tab-general-link').tab('show');

            // Inicializar DataTables de tabs
            initTabDataTables();

            // Cargar datos si es modificacion o visualizacion
            if (data && (mode === 'modificacion' || mode === 'visualizacion')) {
                loadPerfilData(data.Codigo);
            } else {
                $$.loading(false);
            }

            // Foco
            if (mode === 'alta') {
                $('#fld-codigo').focus();
            } else if (mode === 'modificacion') {
                $('#fld-nombre').focus();
            }
        });
    }

    // ========================================================================
    // Cargar datos de un perfil especifico (con script)
    // ========================================================================
    function loadPerfilData(codigo) {
        $$.loading(true);

        bound.execPPL("GetPerfil('" + codigo + "')").then(function(result) {
            var data = result;

            // Manejar diferentes formatos de respuesta
            if (Array.isArray(result)) {
                if (result.length > 0 && Array.isArray(result[0])) {
                    data = transformRow(result[0]);
                } else if (result.length > 0) {
                    data = transformRow(result);
                }
            } else if (result && result.result) {
                data = transformData(result)[0] || {};
            }

            var perfCodigo = data.Codigo || data.codigo || codigo;
            var perfNombre = data.Nombre || data.nombre || '';
            var perfScript = data.Script || data.script || '';

            $('#fld-codigo').val(perfCodigo);
            $('#fld-nombre').val(perfNombre);

            // Parsear script para marcar checkboxes
            if (perfScript) {
                parseScript(perfScript);
            }

            // Los canales NO salen del script: se leen de MENSAJES_CANALES_PERFIL.
            return loadCanalesPerfil(perfCodigo, perfScript).then(function() {
                // Refrescar DataTables de tabs con los datos actualizados
                refreshTabDataTables();
                updateTabCounts();

                $$.loading(false);
            });
        }).catch(function(error) {
            $$.loading(false);
            console.error('Error cargando perfil:', error);
            showError('Error al cargar el perfil');
        });
    }

    // ========================================================================
    // Resetear permisos a estado base (todo desmarcado)
    // ========================================================================
    function resetPermissions() {
        permData.menu = cloneArray(BASE_ITEMS_MENU);
        permData.tablas = cloneArray(BASE_TABLAS_ABM);
        permData.tiposop = cloneArray(BASE_TIPOS_OPERACION);
        permData.tipostr = cloneArray(BASE_TIPOS_TRANSACCION);
        permData.tiposord = cloneArray(BASE_TIPOS_ORDEN);
        permData.informes = cloneArray(BASE_INFORMES);
        permData.eventos = cloneArray(BASE_EVENTOS);
        permData.especiales = cloneArray(BASE_ESPECIALES);
        permData.variables = cloneArray(BASE_VARIABLES);
        permData.instancias = cloneArray(BASE_INSTANCIAS);
        permData.webviews = cloneArray(BASE_WEBVIEWS);
        permData.canales = cloneArray(BASE_CANALES);
        permData.directorios = cloneArray(BASE_DIRECTORIOS);
        dirAdmin = false;
    }

    // ========================================================================
    // Parsear script existente para marcar checkboxes
    // ========================================================================
    function parseScript(scriptStr) {
        if (!scriptStr) return;

        var siglas = scriptStr.trim().split(/\s+/);
        var siglaSet = {};
        siglas.forEach(function(s) { siglaSet[s.toUpperCase()] = true; });

        // Items Menu: IT + codMenu
        permData.menu.forEach(function(item) {
            if (siglaSet['IT' + item.codMenu]) {
                item.ver = true;
            }
        });

        // Tablas: prefijo + A/B/M/V/D
        permData.tablas.forEach(function(t) {
            if (siglaSet[t.prefijo + 'A']) t.alta = true;
            if (siglaSet[t.prefijo + 'B']) t.baja = true;
            if (siglaSet[t.prefijo + 'M']) t.modificacion = true;
            if (siglaSet[t.prefijo + 'V']) t.ver = true;
            if (siglaSet[t.prefijo + 'D']) t.doble = true;
        });

        // Tipos Operacion: TO + codigo
        permData.tiposop.forEach(function(r) {
            if (siglaSet['TO' + r.codigo.toUpperCase()]) r.hab = true;
        });

        // Tipos Transaccion: TT + codigo
        permData.tipostr.forEach(function(r) {
            if (siglaSet['TT' + r.codigo.toUpperCase()]) r.hab = true;
        });

        // Tipos Orden: T0 + codigo
        permData.tiposord.forEach(function(r) {
            if (siglaSet['T0' + r.codigo.toUpperCase()]) r.hab = true;
        });

        // Informes: IN + codigo
        permData.informes.forEach(function(r) {
            if (siglaSet['IN' + r.codigo.toUpperCase()]) r.hab = true;
        });

        // Eventos: EV + codigo
        permData.eventos.forEach(function(r) {
            if (siglaSet['EV' + r.codigo.toUpperCase()]) r.hab = true;
        });

        // Especiales: codigo directo
        permData.especiales.forEach(function(r) {
            if (siglaSet[r.codigo.toUpperCase()]) r.hab = true;
        });

        // Variables: VA + codigo
        permData.variables.forEach(function(r) {
            if (siglaSet['VA' + r.codigo.toUpperCase()]) r.hab = true;
        });

        // Instancias: TODO - parseo pendiente

        // Vistas Web: VW + codigo
        permData.webviews.forEach(function(r) {
            if (siglaSet['VW' + r.codigo.toUpperCase()]) r.hab = true;
        });

        // Canales: NO se parsean del script. Desde FPAV7-387 los permisos de canal
        // viven en MENSAJES_CANALES_PERFIL (ver loadCanalesPerfil); los tokens
        // #{id}_OB / #{id}_OP del script ya no los lee el backend.

        // Directorios (object storage): DIR{dir} / DIW{dir} + DIF pelado (admin).
        // Se parsea sobre el token CRUDO (siglaSet esta en mayusculas y los paths de
        // SeaweedFS distinguen may/min). DIW gana sobre DIR (niveles anidados). DIF de
        // EXACTAMENTE 3 chars = admin del filesystem; DIF{sufijo} se ignora (token
        // desconocido para el backend). Mergea los roots ya cargados con directorios que
        // solo esten en el script (asi se ven aunque /storage/roots haya fallado).
        siglas.forEach(function(raw) {
            if (!raw) return;
            var p3 = raw.substring(0, 3).toUpperCase();
            if (raw.length === 3 && p3 === 'DIF') { dirAdmin = true; return; }
            if (raw.length <= 3) return;
            if (p3 !== 'DIR' && p3 !== 'DIW') return;
            var dir = raw.substring(3);                 // case preservado (path case-sensitive)
            var entry = null;
            for (var i = 0; i < permData.directorios.length; i++) {
                if (permData.directorios[i].dir === dir) { entry = permData.directorios[i]; break; }
            }
            if (!entry) {
                entry = { dir: dir, permiso: 'ninguno' };
                permData.directorios.push(entry);
            }
            if (p3 === 'DIW') entry.permiso = 'diw';
            else if (entry.permiso !== 'diw') entry.permiso = 'dir';
        });
    }

    // ========================================================================
    // Generacion de Script (port de scriptGenerator.ts)
    // ========================================================================
    function generateScript() {
        var siglas = [];

        // Items Menu: IT + codMenu
        permData.menu.forEach(function(item) {
            if (item.ver) siglas.push('IT' + item.codMenu);
        });

        // Tablas: prefijo + A/B/M/V/D
        permData.tablas.forEach(function(t) {
            if (t.alta) siglas.push(t.prefijo + 'A');
            if (t.baja) siglas.push(t.prefijo + 'B');
            if (t.modificacion) siglas.push(t.prefijo + 'M');
            if (t.ver) siglas.push(t.prefijo + 'V');
            if (t.doble) siglas.push(t.prefijo + 'D');
        });

        // Tipos Operacion: TO + codigo
        permData.tiposop.forEach(function(r) {
            if (r.hab) siglas.push('TO' + r.codigo);
        });

        // Tipos Transaccion: TT + codigo
        permData.tipostr.forEach(function(r) {
            if (r.hab) siglas.push('TT' + r.codigo);
        });

        // Tipos Orden: T0 + codigo
        permData.tiposord.forEach(function(r) {
            if (r.hab) siglas.push('T0' + r.codigo);
        });

        // Informes: IN + codigo
        permData.informes.forEach(function(r) {
            if (r.hab) siglas.push('IN' + r.codigo);
        });

        // Eventos: EV + codigo
        permData.eventos.forEach(function(r) {
            if (r.hab) siglas.push('EV' + r.codigo);
        });

        // Especiales: codigo directo
        permData.especiales.forEach(function(r) {
            if (r.hab) siglas.push(r.codigo);
        });

        // Variables: VA + codigo
        permData.variables.forEach(function(r) {
            if (r.hab) siglas.push('VA' + r.codigo);
        });

        // Instancias: TODO

        // Vistas Web: VW + codigo
        permData.webviews.forEach(function(r) {
            if (r.hab) siglas.push('VW' + r.codigo);
        });

        // Canales: NO se emiten tokens al script. Se persisten en
        // MENSAJES_CANALES_PERFIL (SaveCanalesPerfil) -- una sola fuente de verdad.

        // Directorios (object storage): DIR{dir} / DIW{dir}, case preservado. El backend
        // (ProfileService.TryAddDirectoryGrant) parsea el nombre del directorio verbatim.
        permData.directorios.forEach(function(d) {
            if (d.permiso === 'dir')      siglas.push('DIR' + d.dir);
            else if (d.permiso === 'diw') siglas.push('DIW' + d.dir);
        });
        // DIF admin del filesystem: token PELADO de 3 chars (nunca DIF{sufijo}, que el
        // backend trataria como token desconocido).
        if (dirAdmin) siglas.push('DIF');

        return siglas.join(' ');
    }

    function updateScriptOutput() {
        var script = generateScript();
        var count = script ? script.split(/\s+/).length : 0;
        $('#script-output').val(script);
        $('#script-count').text(count);
    }

    // ========================================================================
    // Inicializar DataTables de tabs de permisos
    // ========================================================================
    function initTabDataTables() {
        var isReadonly = (formMode === 'visualizacion');

        // Items Menu
        tabDataTables['#tab-menu'] = $('#dt-menu').DataTable({
            data: permData.menu,
            columns: [
                { data: 'subMenu', title: 'SubMenú' },
                { data: 'item', title: 'Item' },
                { data: 'codMenu', title: 'CodMenú' },
                {
                    data: 'ver', title: 'Ver', className: 'chk-cell',
                    render: function(data, type, row, meta) {
                        if (type === 'display') {
                            return '<input type="checkbox" ' + (data ? 'checked' : '') +
                                   (isReadonly ? ' disabled' : '') +
                                   ' data-tab="menu" data-row="' + meta.row + '" data-field="ver">';
                        }
                        return data;
                    }
                }
            ],
            paging: false, searching: true, info: false, ordering: true, scrollY: '300px', scrollCollapse: true
        });

        // Tablas ABM
        tabDataTables['#tab-tablas'] = $('#dt-tablas').DataTable({
            data: permData.tablas,
            columns: [
                { data: 'nombre', title: 'Nombre' },
                { data: 'codAbm', title: 'Cod.ABM' },
                { data: 'prefijo', title: 'Prefijo' },
                { data: 'alta', title: 'Alta', className: 'chk-cell', render: renderCheckbox('tablas', 'alta', isReadonly) },
                { data: 'baja', title: 'Baja', className: 'chk-cell', render: renderCheckbox('tablas', 'baja', isReadonly) },
                { data: 'modificacion', title: 'Mod.', className: 'chk-cell', render: renderCheckbox('tablas', 'modificacion', isReadonly) },
                { data: 'ver', title: 'Ver', className: 'chk-cell', render: renderCheckbox('tablas', 'ver', isReadonly) },
                { data: 'doble', title: 'Doble', className: 'chk-cell', render: renderCheckbox('tablas', 'doble', isReadonly) }
            ],
            paging: false, searching: true, info: false, ordering: true, scrollY: '300px', scrollCollapse: true
        });

        // Tabs simples (Tipos Op, Tipos Tr, Tipos Ord, Especiales, Variables)
        var simpleTabs = [
            { key: '#tab-tiposop', selector: '#dt-tiposop', data: permData.tiposop, tabName: 'tiposop' },
            { key: '#tab-tipostr', selector: '#dt-tipostr', data: permData.tipostr, tabName: 'tipostr' },
            { key: '#tab-tiposord', selector: '#dt-tiposord', data: permData.tiposord, tabName: 'tiposord' },
            { key: '#tab-especiales', selector: '#dt-especiales', data: permData.especiales, tabName: 'especiales' },
            { key: '#tab-variables', selector: '#dt-variables', data: permData.variables, tabName: 'variables' }
        ];

        simpleTabs.forEach(function(cfg) {
            tabDataTables[cfg.key] = $(cfg.selector).DataTable({
                data: cfg.data,
                columns: [
                    { data: 'codigo', title: 'Código' },
                    { data: 'nombre', title: 'Nombre' },
                    { data: 'hab', title: 'Hab.', className: 'chk-cell', render: renderCheckbox(cfg.tabName, 'hab', isReadonly) }
                ],
                paging: false, searching: true, info: false, ordering: true, scrollY: '300px', scrollCollapse: true
            });
        });

        // Tabs categorizadas (Informes, Eventos, Vistas Web)
        var catTabs = [
            { key: '#tab-informes', selector: '#dt-informes', data: permData.informes, tabName: 'informes' },
            { key: '#tab-eventos', selector: '#dt-eventos', data: permData.eventos, tabName: 'eventos' },
            { key: '#tab-webviews', selector: '#dt-webviews', data: permData.webviews, tabName: 'webviews' }
        ];

        catTabs.forEach(function(cfg) {
            tabDataTables[cfg.key] = $(cfg.selector).DataTable({
                data: cfg.data,
                columns: [
                    { data: 'codigo', title: 'Código' },
                    { data: 'nombre', title: 'Nombre' },
                    { data: 'tipo', title: 'Tipo' },
                    { data: 'hab', title: 'Hab.', className: 'chk-cell', render: renderCheckbox(cfg.tabName, 'hab', isReadonly) }
                ],
                paging: false, searching: true, info: false, ordering: true, scrollY: '300px', scrollCollapse: true
            });
        });

        // Instancias
        tabDataTables['#tab-instancias'] = $('#dt-instancias').DataTable({
            data: permData.instancias,
            columns: [
                { data: 'tabla', title: 'Tabla' },
                { data: 'nrInstancia', title: 'NrInst.' },
                { data: 'nombre', title: 'Nombre' },
                { data: 'alta', title: 'Alta', className: 'chk-cell', render: renderCheckbox('instancias', 'alta', isReadonly) },
                { data: 'baja', title: 'Baja', className: 'chk-cell', render: renderCheckbox('instancias', 'baja', isReadonly) },
                { data: 'modificacion', title: 'Mod.', className: 'chk-cell', render: renderCheckbox('instancias', 'modificacion', isReadonly) },
                { data: 'avanzar', title: 'Avan.', className: 'chk-cell', render: renderCheckbox('instancias', 'avanzar', isReadonly) },
                { data: 'retroceder', title: 'Retr.', className: 'chk-cell', render: renderCheckbox('instancias', 'retroceder', isReadonly) }
            ],
            paging: false, searching: true, info: false, ordering: true, scrollY: '300px', scrollCollapse: true
        });

        // Canales de Mensajes (radio buttons: asignado / restringido)
        tabDataTables['#tab-canales'] = $('#dt-canales').DataTable({
            data: permData.canales,
            columns: [
                { data: 'id', title: 'Id' },
                { data: 'nombre', title: 'Canal' },
                { data: 'descripcion', title: 'Descripción', defaultContent: '' },
                {
                    data: 'permiso', title: 'Permiso', className: 'text-center',
                    render: function(data, type, row, meta) {
                        if (type !== 'display') return data;
                        var name = 'canal-' + meta.row;
                        var dis = isReadonly ? ' disabled' : '';
                        return '<label class="radio-inline mr-3"><input type="radio" name="' + name + '" value="asignado"' + (data === 'asignado' ? ' checked' : '') + dis + ' data-row="' + meta.row + '"> Asignado</label>' +
                               '<label class="radio-inline"><input type="radio" name="' + name + '" value="restringido"' + (data === 'restringido' ? ' checked' : '') + dis + ' data-row="' + meta.row + '"> Restringido</label>';
                    }
                }
            ],
            paging: false, searching: true, info: false, ordering: true, scrollY: '300px', scrollCollapse: true
        });

        // Directorios de object storage (radios: ninguno / dir / diw). Con DIF (dirAdmin)
        // activo, los radios quedan deshabilitados: el admin del filesystem cubre todo.
        tabDataTables['#tab-directorios'] = $('#dt-directorios').DataTable({
            data: permData.directorios,
            columns: [
                { data: 'dir', title: 'Directorio' },
                {
                    data: 'permiso', title: 'Permiso', className: 'text-center',
                    render: function(data, type, row, meta) {
                        if (type !== 'display') return data;
                        var name = 'dir-' + meta.row;
                        var dis = (isReadonly || dirAdmin) ? ' disabled' : '';
                        return '<label class="radio-inline mr-3"><input type="radio" name="' + name + '" value="ninguno"' + (data === 'ninguno' ? ' checked' : '') + dis + ' data-row="' + meta.row + '"> Ninguno</label>' +
                               '<label class="radio-inline mr-3"><input type="radio" name="' + name + '" value="dir"' + (data === 'dir' ? ' checked' : '') + dis + ' data-row="' + meta.row + '"> DIR</label>' +
                               '<label class="radio-inline"><input type="radio" name="' + name + '" value="diw"' + (data === 'diw' ? ' checked' : '') + dis + ' data-row="' + meta.row + '"> DIW</label>';
                    }
                }
            ],
            paging: false, searching: true, info: false, ordering: true, scrollY: '300px', scrollCollapse: true
        });

        // Estado inicial del checkbox DIF y del aviso de sin-permiso (se re-sincronizan
        // tras parseScript en refreshTabDataTables).
        $('#chk-dir-admin').prop('checked', dirAdmin).prop('disabled', isReadonly);
        $('#directorios-sin-permiso').toggle(!storageRootsAccessible);
        // Solo un admin del filesystem puede ASIGNAR DIF: el panel se oculta para el resto.
        // storageRootsAccessible sale del 403 de /storage/roots (admin-only), asi que hereda
        // el gate real del backend (SuperUser | perfil ADMIN | DIF) sin duplicar la regla acá
        // — incluido el caso multi-perfil de USUARIOS.Perfiles, que el backend resuelve con
        // Any() sobre la lista. Se OCULTA (no se resetea) a proposito: dirAdmin conserva lo
        // que parseo del Script y generateScript lo re-emite, asi que un no-admin que edita
        // un perfil con DIF no se lo borra sin querer.
        $('#panel-dir-admin').toggle(storageRootsAccessible);

        // Listener global para checkboxes
        setupCheckboxListeners();
        updateTabCounts();
    }

    // ========================================================================
    // Render function para checkboxes en DataTables
    // ========================================================================
    function renderCheckbox(tabName, field, isReadonly) {
        return function(data, type, row, meta) {
            if (type === 'display') {
                return '<input type="checkbox" ' + (data ? 'checked' : '') +
                       (isReadonly ? ' disabled' : '') +
                       ' data-tab="' + tabName + '" data-row="' + meta.row + '" data-field="' + field + '">';
            }
            return data ? 1 : 0;
        };
    }

    // ========================================================================
    // Listener de cambio de checkboxes
    // ========================================================================
    function setupCheckboxListeners() {
        $('.tab-pane').on('change', 'input[type="checkbox"][data-tab]', function() {
            var tab = $(this).data('tab');
            var rowIdx = $(this).data('row');
            var field = $(this).data('field');
            var checked = $(this).is(':checked');

            // Actualizar dato en el array
            if (permData[tab] && permData[tab][rowIdx] !== undefined) {
                permData[tab][rowIdx][field] = checked;
            }

            updateTabCounts();
        });

        // Listener para radio buttons de canales
        $('#tab-canales').on('change', 'input[type="radio"]', function() {
            var rowIdx = $(this).data('row');
            var value = $(this).val();
            if (permData.canales[rowIdx]) {
                permData.canales[rowIdx].permiso = value;
            }
            updateTabCounts();
        });

        // Listener para radio buttons de directorios (object storage)
        $('#tab-directorios').on('change', 'input[type="radio"]', function() {
            var rowIdx = $(this).data('row');
            var value = $(this).val();
            if (permData.directorios[rowIdx]) {
                permData.directorios[rowIdx].permiso = value;
            }
            updateTabCounts();
        });

        // Checkbox DIF (admin del filesystem). Plan A: al tildarlo, los permisos por
        // directorio quedan deshabilitados (DIF ya cubre todo); se rehabilitan al destildar.
        $('#chk-dir-admin').on('change', function() {
            dirAdmin = $(this).is(':checked');
            if (tabDataTables['#tab-directorios']) {
                tabDataTables['#tab-directorios'].rows().invalidate().draw(false);
            }
            updateTabCounts();
        });
    }

    // ========================================================================
    // Actualizar contadores en los tabs
    // ========================================================================
    function updateTabCounts() {
        var counts = {
            'menu': permData.menu.filter(function(i) { return i.ver; }).length,
            'tablas': permData.tablas.filter(function(t) { return t.alta || t.baja || t.modificacion || t.ver || t.doble; }).length,
            'tiposop': permData.tiposop.filter(function(r) { return r.hab; }).length,
            'tipostr': permData.tipostr.filter(function(r) { return r.hab; }).length,
            'tiposord': permData.tiposord.filter(function(r) { return r.hab; }).length,
            'informes': permData.informes.filter(function(r) { return r.hab; }).length,
            'eventos': permData.eventos.filter(function(r) { return r.hab; }).length,
            'especiales': permData.especiales.filter(function(r) { return r.hab; }).length,
            'variables': permData.variables.filter(function(r) { return r.hab; }).length,
            'instancias': permData.instancias.filter(function(i) { return i.alta || i.baja || i.modificacion || i.avanzar || i.retroceder; }).length,
            'webviews': permData.webviews.filter(function(r) { return r.hab; }).length,
            'canales': permData.canales.filter(function(c) { return c.permiso === 'asignado'; }).length,
            'directorios': permData.directorios.filter(function(d) { return d.permiso !== 'ninguno'; }).length
        };

        Object.keys(counts).forEach(function(key) {
            var el = $('#count-' + key);
            el.text(counts[key]);
            if (counts[key] > 0) {
                el.removeClass('zero');
            } else {
                el.addClass('zero');
            }
        });
    }

    // ========================================================================
    // Refrescar DataTables de tabs (despues de parsear script)
    // ========================================================================
    function refreshTabDataTables() {
        var tabMap = {
            '#tab-menu': permData.menu,
            '#tab-tablas': permData.tablas,
            '#tab-tiposop': permData.tiposop,
            '#tab-tipostr': permData.tipostr,
            '#tab-tiposord': permData.tiposord,
            '#tab-informes': permData.informes,
            '#tab-eventos': permData.eventos,
            '#tab-especiales': permData.especiales,
            '#tab-variables': permData.variables,
            '#tab-instancias': permData.instancias,
            '#tab-webviews': permData.webviews,
            '#tab-canales': permData.canales,
            '#tab-directorios': permData.directorios
        };

        Object.keys(tabMap).forEach(function(key) {
            if (tabDataTables[key]) {
                tabDataTables[key].clear().rows.add(tabMap[key]).draw();
            }
        });

        // Directorios: sincronizar el checkbox DIF y el aviso de sin-permiso con el
        // estado ya parseado del Script (parseScript corre antes de este refresh).
        $('#chk-dir-admin').prop('checked', dirAdmin);
        $('#directorios-sin-permiso').toggle(!storageRootsAccessible);
        // Ver initTabDataTables: el panel de DIF solo se muestra al admin del filesystem.
        $('#panel-dir-admin').toggle(storageRootsAccessible);
    }

    // ========================================================================
    // Destruir DataTables de tabs (al volver a grilla)
    // ========================================================================
    function destroyTabDataTables() {
        Object.keys(tabDataTables).forEach(function(key) {
            if (tabDataTables[key]) {
                tabDataTables[key].destroy();
            }
        });
        tabDataTables = {};

        // Limpiar listeners de checkboxes y radio buttons
        $('.tab-pane').off('change', 'input[type="checkbox"][data-tab]');
        $('#tab-canales').off('change', 'input[type="radio"]');
        $('#tab-directorios').off('change', 'input[type="radio"]');
        $('#chk-dir-admin').off('change');
    }

    // ========================================================================
    // Seleccionar / Deseleccionar todos (funciones publicas)
    // ========================================================================
    PERFILES.selectAll = function(tabName) {
        if (formMode === 'visualizacion') return;
        setAllPermissions(tabName, true);
    };

    PERFILES.deselectAll = function(tabName) {
        if (formMode === 'visualizacion') return;
        setAllPermissions(tabName, false);
    };

    function setAllPermissions(tabName, value) {
        var data = permData[tabName];
        if (!data) return;

        if (tabName === 'menu') {
            data.forEach(function(item) { item.ver = value; });
        } else if (tabName === 'tablas') {
            data.forEach(function(t) {
                t.alta = value; t.baja = value; t.modificacion = value; t.ver = value; t.doble = value;
            });
        } else if (tabName === 'instancias') {
            data.forEach(function(i) {
                i.alta = value; i.baja = value; i.modificacion = value; i.avanzar = value; i.retroceder = value;
            });
        } else if (tabName === 'canales') {
            data.forEach(function(c) { c.permiso = value ? 'asignado' : 'restringido'; });
        } else if (tabName === 'directorios') {
            if (dirAdmin) return;   // DIF cubre todo; los grants por-directorio estan deshabilitados
            data.forEach(function(d) { d.permiso = value ? 'dir' : 'ninguno'; });
        } else {
            data.forEach(function(r) { r.hab = value; });
        }

        // Refrescar la DataTable especifica
        var tabKeyMap = {
            'menu': '#tab-menu', 'tablas': '#tab-tablas', 'tiposop': '#tab-tiposop',
            'tipostr': '#tab-tipostr', 'tiposord': '#tab-tiposord', 'informes': '#tab-informes',
            'eventos': '#tab-eventos', 'especiales': '#tab-especiales', 'variables': '#tab-variables',
            'instancias': '#tab-instancias', 'webviews': '#tab-webviews', 'canales': '#tab-canales',
            'directorios': '#tab-directorios'
        };

        var dtKey = tabKeyMap[tabName];
        if (dtKey && tabDataTables[dtKey]) {
            tabDataTables[dtKey].clear().rows.add(data).draw();
        }

        updateTabCounts();
    }

    // ========================================================================
    // Navegacion entre perfiles (Anterior / Siguiente)
    // ========================================================================
    function navigatePerfil(direction) {
        if (currentPerfilIndex < 0) return;

        var newIndex = currentPerfilIndex + direction;
        if (newIndex < 0 || newIndex >= perfilesData.length) return;

        currentPerfilIndex = newIndex;
        var perfil = perfilesData[newIndex];

        resetPermissions();
        clearForm();
        loadPerfilData(perfil.Codigo);
        updateNavButtons();
    }

    function updateNavButtons() {
        var atStart = currentPerfilIndex <= 0;
        var atEnd = currentPerfilIndex >= perfilesData.length - 1;

        $('#btn-anterior').prop('disabled', atStart || formMode === 'alta');
        $('#btn-siguiente').prop('disabled', atEnd || formMode === 'alta');
    }

    // ========================================================================
    // Formulario: limpiar, validar
    // ========================================================================
    function clearForm() {
        $('#fld-codigo').val('');
        $('#fld-nombre').val('');
        $('#script-output').val('');
        $('#script-count').text('0');

        // Resetear filtros y busquedas de tabs
        $('#filter-menu, #filter-tablas, #filter-informes, #filter-eventos, #filter-instancias').val('');
        $('[id^="search-"]').val('');
    }

    function validateForm() {
        var codigo = $('#fld-codigo').val().trim();
        var nombre = $('#fld-nombre').val().trim();

        if (!codigo) {
            showNotification('El campo Código es obligatorio', 'warning');
            $('#fld-codigo').focus();
            return false;
        }
        if (!nombre) {
            showNotification('El campo Nombre es obligatorio', 'warning');
            $('#fld-nombre').focus();
            return false;
        }
        return true;
    }

    // ========================================================================
    // Submit del formulario (Alta o Modificacion)
    // ========================================================================
    function submitForm() {
        if (!validateForm()) return;

        var codigo = $('#fld-codigo').val().trim();
        var nombre = $('#fld-nombre').val().trim();
        var script = generateScript();

        // Escapar comillas simples para PPL
        nombre = nombre.replace(/'/g, "''");
        script = script.replace(/'/g, "''");

        $$.loading(true);

        var pplCode;
        if (formMode === 'alta') {
            pplCode = "InsertPerfil('" + codigo + "', '" + nombre + "', '" + script + "')";
        } else if (formMode === 'modificacion') {
            pplCode = "UpdatePerfil('" + codigo + "', '" + nombre + "', '" + script + "')";
        }

        var wasAlta = (formMode === 'alta');
        var canalesAsignados = getCanalesAsignados();

        bound.execPPL(pplCode).then(function(result) {
            // Los permisos de canal se persisten aparte (MENSAJES_CANALES_PERFIL),
            // despues de que el perfil exista.
            return bound.execPPL("SaveCanalesPerfil('" + codigo + "', '" + canalesAsignados + "')");
        }).then(function() {
            $$.loading(false);

            var msg = wasAlta
                ? 'Perfil ' + codigo + ' creado correctamente'
                : 'Perfil ' + codigo + ' modificado correctamente';

            showNotification(msg, 'success');
            showGrid();
            loadPerfiles();
        }).catch(function(error) {
            $$.loading(false);
            console.error('Error guardando perfil:', error);
            showError('Error al guardar el perfil: ' + error.message);
        });
    }

    // ========================================================================
    // Eliminar perfil
    // ========================================================================
    function deletePerfil() {
        if (!selectedData) return;

        var codigo = selectedData.Codigo;
        $('#modalDelete').modal('hide');
        $$.loading(true);

        bound.execPPL("DeletePerfil('" + codigo + "')").then(function(result) {
            $$.loading(false);
            showNotification('Perfil ' + codigo + ' eliminado correctamente', 'success');
            clearSelection();
            loadPerfiles();
        }).catch(function(error) {
            $$.loading(false);
            console.error('Error eliminando perfil:', error);
            showError('Error al eliminar el perfil: ' + error.message);
        });
    }

    // ========================================================================
    // Seleccion
    // ========================================================================
    function clearSelection() {
        if (selectedRow) {
            $(selectedRow).removeClass('selected');
        }
        selectedRow = null;
        selectedData = null;
    }

    // ========================================================================
    // Utilidades
    // ========================================================================
    function showNotification(message, type) {
        type = type || 'info';
        var alertClass = {
            'info': 'alert-info',
            'success': 'alert-success',
            'warning': 'alert-warning',
            'error': 'alert-danger',
            'danger': 'alert-danger'
        }[type] || 'alert-info';

        var notification = $('<div class="alert ' + alertClass + ' alert-dismissible fade show position-fixed" role="alert" style="top: 20px; right: 20px; z-index: 9999;">')
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
    // Prevenir navegacion no deseada dentro del iframe
    // ========================================================================
    function preventUnwantedNavigation() {
        $(document).on('click', 'a[href="#"], a[href=""], a:not([href])', function(e) {
            e.preventDefault();
            e.stopPropagation();
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
