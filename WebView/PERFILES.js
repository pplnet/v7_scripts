/* ============================================================================
   JavaScript: Perfiles de Usuario
   ============================================================================
   Logica de interactividad y comunicacion con backend PPL para Alta, Baja
   y Modificacion de Perfiles de Usuario del sistema.
   Incluye 12 tabs de permisos con datos hardcodeados y generacion de script.
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
        instancias: []
    };

    // ========================================================================
    // DATOS HARDCODEADOS DE PERMISOS
    // (Copiados de perfilEditMockData.ts - se reemplazaran por queries reales)
    // ========================================================================

    var BASE_ITEMS_MENU = [
        { subMenu: "Ordenes", item: "Compliance Ordenes", codMenu: "669", ver: false },
        { subMenu: "Ordenes", item: "Pendiente Adjudic", codMenu: "604", ver: false },
        { subMenu: "Ordenes", item: "Post Siopel CPC1", codMenu: "571", ver: false },
        { subMenu: "Ordenes", item: "Anulacion Oferta", codMenu: "531", ver: false },
        { subMenu: "Ordenes", item: "Siopel Incompleto", codMenu: "504", ver: false },
        { subMenu: "Ordenes", item: "Rechazada", codMenu: "570", ver: false },
        { subMenu: "Ordenes", item: "Auxiliar BYMA", codMenu: "550", ver: false },
        { subMenu: "Ordenes", item: "Sup.NO Bloq.Saldos", codMenu: "609", ver: false },
        { subMenu: "Ordenes", item: "Ejecutada", codMenu: "509", ver: false },
        { subMenu: "Ordenes", item: "Rta.Inf. al MAE", codMenu: "662", ver: false },
        { subMenu: "Ordenes", item: "Carga Orden", codMenu: "501", ver: false },
        { subMenu: "Ordenes", item: "Terminal", codMenu: "670", ver: false },
        { subMenu: "Ordenes", item: "Carga Manifestacion", codMenu: "601", ver: false },
        { subMenu: "Ordenes", item: "Auxiliar MAE", codMenu: "650", ver: false },
        { subMenu: "Ordenes", item: "Sup. Ctrl Precio", codMenu: "540", ver: false },
        { subMenu: "Transacciones", item: "Transportes de Liq.", codMenu: "915", ver: false },
        { subMenu: "Transacciones", item: "Transacciones", codMenu: "900", ver: false },
        { subMenu: "Transacciones", item: "Ajuste de Resultados", codMenu: "909", ver: false },
        { subMenu: "Transacciones", item: "Anulacion", codMenu: "930", ver: false },
        { subMenu: "Transacciones", item: "Fallas", codMenu: "908", ver: false },
        { subMenu: "Operaciones", item: "Carga Operacion", codMenu: "201", ver: false },
        { subMenu: "Operaciones", item: "Eventuales", codMenu: "210", ver: false },
        { subMenu: "Operaciones", item: "Minoristas", codMenu: "220", ver: false },
        { subMenu: "Operaciones", item: "Anulacion", codMenu: "230", ver: false },
        { subMenu: "Archivo", item: "Clientes", codMenu: "101", ver: false },
        { subMenu: "Archivo", item: "Especies", codMenu: "102", ver: false },
        { subMenu: "Archivo", item: "Agentes", codMenu: "103", ver: false },
        { subMenu: "Archivo", item: "Monedas", codMenu: "104", ver: false },
        { subMenu: "Utilitarios", item: "Backup", codMenu: "801", ver: false },
        { subMenu: "Utilitarios", item: "Restore", codMenu: "802", ver: false },
        { subMenu: "Utilitarios", item: "Parametros", codMenu: "810", ver: false }
    ];

    var BASE_TABLAS_ABM = [
        { nombre: "Automaticos", codAbm: "__AUTO", prefijo: "AU", alta: false, baja: false, modificacion: false, ver: false, doble: false },
        { nombre: "Cuentas Contables", codAbm: "__CCON", prefijo: "CN", alta: false, baja: false, modificacion: false, ver: false, doble: false },
        { nombre: "Filtros", codAbm: "__FILT", prefijo: "FI", alta: false, baja: false, modificacion: false, ver: false, doble: false },
        { nombre: "Modelos de Asiento", codAbm: "__MASI", prefijo: "MA", alta: false, baja: false, modificacion: false, ver: false, doble: false },
        { nombre: "Numeradores", codAbm: "__NUME", prefijo: "NU", alta: false, baja: false, modificacion: false, ver: false, doble: false },
        { nombre: "Perfiles de Usuarios", codAbm: "__PERF", prefijo: "P2", alta: false, baja: false, modificacion: false, ver: false, doble: false },
        { nombre: "Relacion Cuenta", codAbm: "__RCUE", prefijo: "RC", alta: false, baja: false, modificacion: false, ver: false, doble: false },
        { nombre: "Supervision", codAbm: "__SUP", prefijo: "_S", alta: false, baja: false, modificacion: false, ver: false, doble: false },
        { nombre: "Tipos de Asiento", codAbm: "__TASI", prefijo: "TS", alta: false, baja: false, modificacion: false, ver: false, doble: false },
        { nombre: "Usuarios", codAbm: "__USU", prefijo: "US", alta: false, baja: false, modificacion: false, ver: false, doble: false },
        { nombre: "Variables", codAbm: "__VARI", prefijo: "VA", alta: false, baja: false, modificacion: false, ver: false, doble: false },
        { nombre: "Configuracion Valores Externos Integr.", codAbm: "ABMC", prefijo: "AD", alta: false, baja: false, modificacion: false, ver: false, doble: false },
        { nombre: "Ejemplo de abm", codAbm: "ABME", prefijo: "ABB", alta: false, baja: false, modificacion: false, ver: false, doble: false },
        { nombre: "Actividades BCRA", codAbm: "ACBCRA", prefijo: "AC", alta: false, baja: false, modificacion: false, ver: false, doble: false },
        { nombre: "Acuerdos Cuenta", codAbm: "ACCTA", prefijo: "A3", alta: false, baja: false, modificacion: false, ver: false, doble: false },
        { nombre: "Acuerdos Globales", codAbm: "ACGLO", prefijo: "A1", alta: false, baja: false, modificacion: false, ver: false, doble: false },
        { nombre: "Acuerdos Tipo Cliente", codAbm: "ACTCL", prefijo: "A2", alta: false, baja: false, modificacion: false, ver: false, doble: false },
        { nombre: "Agenda Cupones", codAbm: "AGENDA", prefijo: "AP", alta: false, baja: false, modificacion: false, ver: false, doble: false },
        { nombre: "Agentes", codAbm: "AGENT", prefijo: "AG", alta: false, baja: false, modificacion: false, ver: false, doble: false },
        { nombre: "Aranceles Cliente", codAbm: "ARAN", prefijo: "AL", alta: false, baja: false, modificacion: false, ver: false, doble: false }
    ];

    var BASE_TIPOS_OPERACION = [
        { codigo: "CAMBIO", nombre: "Cambio", hab: false },
        { codigo: "CAUCION", nombre: "Caucion", hab: false },
        { codigo: "CHEQUE", nombre: "Cheque", hab: false },
        { codigo: "CONTADO", nombre: "Contado", hab: false },
        { codigo: "EXTER", nombre: "Exterior", hab: false },
        { codigo: "FONDOS", nombre: "Fondos Comunes", hab: false },
        { codigo: "FUTURO", nombre: "Futuro", hab: false },
        { codigo: "LICITAC", nombre: "Licitacion", hab: false },
        { codigo: "MINORI", nombre: "Minorista", hab: false },
        { codigo: "OPCFUT", nombre: "Opcion sobre Futuro", hab: false },
        { codigo: "OPCION", nombre: "Opcion", hab: false },
        { codigo: "PLAZO", nombre: "Plazo Fijo", hab: false },
        { codigo: "PRESTA", nombre: "Prestamo", hab: false }
    ];

    var BASE_TIPOS_TRANSACCION = [
        { codigo: "ACRED", nombre: "Acreditacion", hab: false },
        { codigo: "AJUSTE", nombre: "Ajuste", hab: false },
        { codigo: "CANJES", nombre: "Canjes", hab: false },
        { codigo: "COBRO", nombre: "Cobro", hab: false },
        { codigo: "DEBITO", nombre: "Debito", hab: false },
        { codigo: "DIVID", nombre: "Dividendo", hab: false },
        { codigo: "GASTOS", nombre: "Gastos", hab: false },
        { codigo: "INTERE", nombre: "Intereses", hab: false },
        { codigo: "MOVI", nombre: "Movimiento", hab: false },
        { codigo: "PAGO", nombre: "Pago", hab: false },
        { codigo: "RENTA", nombre: "Renta", hab: false },
        { codigo: "RETIRO", nombre: "Retiro", hab: false },
        { codigo: "TRANSP", nombre: "Transporte", hab: false }
    ];

    var BASE_TIPOS_ORDEN = [
        { codigo: "TMANIF", nombre: "Manifestacion", hab: false },
        { codigo: "OTIV", nombre: "Orden Titulos Valores", hab: false },
        { codigo: "PRUORD", nombre: "Prueba Orden", hab: false },
        { codigo: "SIOPCAM", nombre: "Siopel Cambio", hab: false },
        { codigo: "SIOPELD", nombre: "Siopel Dolares", hab: false },
        { codigo: "SIOPELP", nombre: "Siopel Pesos", hab: false },
        { codigo: "TVBYMA", nombre: "TV BYMA", hab: false }
    ];

    var BASE_INFORMES = [
        { codigo: "BOLETO", nombre: "Boleto", tipo: "Operaciones", hab: false },
        { codigo: "CTACTE", nombre: "Cuenta Corriente", tipo: "Operaciones", hab: false },
        { codigo: "ESTADO", nombre: "Estado de Cuenta", tipo: "Operaciones", hab: false },
        { codigo: "LIQUI", nombre: "Liquidacion", tipo: "Operaciones", hab: false },
        { codigo: "POSIC", nombre: "Posicion", tipo: "Operaciones", hab: false },
        { codigo: "RENTER", nombre: "Renta Exterior", tipo: "Transacciones", hab: false },
        { codigo: "RENTLOC", nombre: "Renta Local", tipo: "Transacciones", hab: false },
        { codigo: "SALDOS", nombre: "Saldos", tipo: "Transacciones", hab: false },
        { codigo: "TENENC", nombre: "Tenencia", tipo: "Transacciones", hab: false },
        { codigo: "CUSTOD", nombre: "Custodia", tipo: "Utilitarios", hab: false },
        { codigo: "DIARIO", nombre: "Diario Contable", tipo: "Utilitarios", hab: false },
        { codigo: "MAYOR", nombre: "Mayor Contable", tipo: "Utilitarios", hab: false }
    ];

    var BASE_EVENTOS = [
        { codigo: "1", nombre: "PRUEBA_EVENTO", tipo: "", hab: false },
        { codigo: "2434", nombre: "esperar", tipo: "", hab: false },
        { codigo: "ANMBKO", nombre: "Anulacion de Modificacion de Book en Op", tipo: "", hab: false },
        { codigo: "E_API", nombre: "Traer nombre especies", tipo: "", hab: false },
        { codigo: "E_ASCI", nombre: "Evento importar exportar TXT Pedro", tipo: "", hab: false },
        { codigo: "E_UNDO", nombre: "Recuperar Valor 1 Especies", tipo: "", hab: false },
        { codigo: "EJAPI", nombre: "Modificacion de tablas", tipo: "", hab: false },
        { codigo: "EJTXT", nombre: "Importar y exportar txt", tipo: "", hab: false },
        { codigo: "INTLAV", nombre: "Interfaz de Lavado de Dinero", tipo: "", hab: false },
        { codigo: "NUBNDF", nombre: "Numerador Boleto NDF", tipo: "", hab: false },
        { codigo: "YCONF2", nombre: "YCONFI EjecutarEvento2", tipo: "", hab: false },
        { codigo: "AVOPME", nombre: "Avanza operaciones Mercados", tipo: "Ordenes", hab: false },
        { codigo: "CAMARA", nombre: "Cambio Arancel Acciones", tipo: "Ordenes", hab: false },
        { codigo: "__EXPO", nombre: "Exportar Script PPL (DB)", tipo: "Auxiliares", hab: false },
        { codigo: "000010", nombre: "VUECTA", tipo: "Auxiliares", hab: false },
        { codigo: "42", nombre: "bajar datos a un txt", tipo: "Auxiliares", hab: false }
    ];

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

    var BASE_VARIABLES = [
        { codigo: "ABIERTO", nombre: "ABIERTO", hab: false },
        { codigo: "ACTCONFILA", nombre: "ACTCON Limite de filas", hab: false },
        { codigo: "ACTCOTFILA", nombre: "ACTCOT Limite de filas", hab: false },
        { codigo: "ACTPOS", nombre: "Actualizacion Posicion", hab: false },
        { codigo: "AGESIOP", nombre: "AGESIOP", hab: false },
        { codigo: "ALTACLI", nombre: "PATH CLI. DE BANTOTAL", hab: false },
        { codigo: "ALTCLIPROC", nombre: "PATH CLIBT PROCESADOS", hab: false },
        { codigo: "AMBBYMA", nombre: "Ambito de Negoc. BYMA", hab: false },
        { codigo: "AMBIENTE", nombre: "Ambiente DES o PROD", hab: false },
        { codigo: "AMBMAE", nombre: "Ambito de Negociacion MAE", hab: false },
        { codigo: "AMBOCT", nombre: "Ambito de Negociacion OCT", hab: false },
        { codigo: "AMBROFEX", nombre: "Ambito de Negociacion RFX", hab: false },
        { codigo: "ARCCOTESP", nombre: "Nombre de Planilla Esp", hab: false },
        { codigo: "ARCHBASCON", nombre: "Arch. Asientos Cont.", hab: false },
        { codigo: "ASINUM", nombre: "Numerador de Asientos", hab: false }
    ];

    var BASE_INSTANCIAS = [
        { tabla: "Operaciones", nrInstancia: "1", nombre: "Carga", alta: false, baja: false, modificacion: false, avanzar: false, retroceder: false },
        { tabla: "Operaciones", nrInstancia: "2", nombre: "Supervision", alta: false, baja: false, modificacion: false, avanzar: false, retroceder: false },
        { tabla: "Operaciones", nrInstancia: "3", nombre: "Confirmacion", alta: false, baja: false, modificacion: false, avanzar: false, retroceder: false },
        { tabla: "Operaciones", nrInstancia: "4", nombre: "Liquidacion", alta: false, baja: false, modificacion: false, avanzar: false, retroceder: false },
        { tabla: "Transacciones", nrInstancia: "1", nombre: "Carga", alta: false, baja: false, modificacion: false, avanzar: false, retroceder: false },
        { tabla: "Transacciones", nrInstancia: "2", nombre: "Supervision", alta: false, baja: false, modificacion: false, avanzar: false, retroceder: false },
        { tabla: "Transacciones", nrInstancia: "3", nombre: "Confirmacion", alta: false, baja: false, modificacion: false, avanzar: false, retroceder: false },
        { tabla: "Ordenes", nrInstancia: "1", nombre: "Carga", alta: false, baja: false, modificacion: false, avanzar: false, retroceder: false },
        { tabla: "Ordenes", nrInstancia: "2", nombre: "Supervision", alta: false, baja: false, modificacion: false, avanzar: false, retroceder: false },
        { tabla: "Ordenes", nrInstancia: "3", nombre: "Ejecucion", alta: false, baja: false, modificacion: false, avanzar: false, retroceder: false },
        { tabla: "Ordenes", nrInstancia: "4", nombre: "Confirmacion", alta: false, baja: false, modificacion: false, avanzar: false, retroceder: false }
    ];

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
            'script': 'Script'
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
            'search-instancias': '#tab-instancias'
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

        // Cargar datos si es modificacion o visualizacion
        if (data && (mode === 'modificacion' || mode === 'visualizacion')) {
            loadPerfilData(data.Codigo);
        }

        // Mostrar vista formulario
        $('#view-grid').hide();
        $('#view-form').show();

        // Activar primer tab
        $('#tab-general-link').tab('show');

        // Inicializar DataTables de tabs
        initTabDataTables();

        // Foco
        if (mode === 'alta') {
            $('#fld-codigo').focus();
        } else if (mode === 'modificacion') {
            $('#fld-nombre').focus();
        }
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

            // Refrescar DataTables de tabs con los datos actualizados
            refreshTabDataTables();
            updateTabCounts();

            $$.loading(false);
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

        // Tabs categorizadas (Informes, Eventos)
        var catTabs = [
            { key: '#tab-informes', selector: '#dt-informes', data: permData.informes, tabName: 'informes' },
            { key: '#tab-eventos', selector: '#dt-eventos', data: permData.eventos, tabName: 'eventos' }
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
            'instancias': permData.instancias.filter(function(i) { return i.alta || i.baja || i.modificacion || i.avanzar || i.retroceder; }).length
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
            '#tab-instancias': permData.instancias
        };

        Object.keys(tabMap).forEach(function(key) {
            if (tabDataTables[key]) {
                tabDataTables[key].clear().rows.add(tabMap[key]).draw();
            }
        });
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

        // Limpiar listeners de checkboxes
        $('.tab-pane').off('change', 'input[type="checkbox"][data-tab]');
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
        } else {
            data.forEach(function(r) { r.hab = value; });
        }

        // Refrescar la DataTable especifica
        var tabKeyMap = {
            'menu': '#tab-menu', 'tablas': '#tab-tablas', 'tiposop': '#tab-tiposop',
            'tipostr': '#tab-tipostr', 'tiposord': '#tab-tiposord', 'informes': '#tab-informes',
            'eventos': '#tab-eventos', 'especiales': '#tab-especiales', 'variables': '#tab-variables',
            'instancias': '#tab-instancias'
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

        bound.execPPL(pplCode).then(function(result) {
            $$.loading(false);

            var msg = formMode === 'alta'
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
