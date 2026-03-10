/* ============================================================================
   JavaScript: ABM de Filtros
   ============================================================================
   Logica de interactividad y comunicacion con backend PPL para Alta, Baja
   y Modificacion de Filtros de instancias.
   ============================================================================ */

(function() {
    'use strict';

    // Variables globales
    var dataTable = null;
    var filtrosData = [];
    var selectedRow = null;
    var selectedData = null;
    var formMode = null; // 'alta', 'modificacion', 'visualizacion'

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

    // Mapeo de claves
    function capitalizeKey(key) {
        if (!key) return key;
        var keyMap = {
            'codigo': 'Codigo',
            'nombre': 'Nombre',
            'perfiles': 'Perfiles',
            'tabla': 'Tabla',
            'columnas': 'Columnas',
            'condiciones': 'Condiciones',
            'orden': 'Orden',
            'nrinstancia': 'NrInstancia'
        };

        var lowerKey = key.toLowerCase();
        if (keyMap[lowerKey]) {
            return keyMap[lowerKey];
        }

        return key.charAt(0).toUpperCase() + key.slice(1);
    }

    // ========================================================================
    // Configuracion de DataTable
    // ========================================================================
    var colsConfig = [
        {
            "data": "Codigo",
            "title": "Codigo"
        },
        {
            "data": "Nombre",
            "title": "Nombre"
        },
        {
            "data": "Tabla",
            "title": "Tabla"
        },
        {
            "data": "NrInstancia",
            "title": "Instancia",
            "render": function(data) {
                var val = parseInt(data, 10) || 0;
                return val === 0 ? '0 (Todas)' : String(val);
            }
        },
        {
            "data": "Perfiles",
            "title": "Perfiles",
            "render": function(data) {
                // Mostrar los perfiles sin el pipe final para mejor lectura
                if (!data) return '';
                return data.replace(/\|$/g, '').replace(/\|/g, ', ');
            }
        }
    ];

    // ========================================================================
    // Inicializacion
    // ========================================================================
    function init() {
        console.log('Inicializando WebView ABM de Filtros...');

        initDataTable();
        loadFiltros();
        setupEventListeners();

        console.log('WebView inicializada correctamente');
    }

    // ========================================================================
    // Inicializar DataTable
    // ========================================================================
    function initDataTable() {
        var dtSelector = '#dt1';

        dataTable = $(dtSelector).DataTable({
            scrollX: true,
            searching: true,
            lengthChange: true,
            pageLength: 25,
            data: filtrosData,
            columns: colsConfig,
            language: {
                zeroRecords: "No se encontraron filtros",
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
            order: [[0, 'asc']] // Ordenar por Codigo ascendente
        });

        $$.setDataTable(dataTable, dtSelector);
        $$.setKeyNames(["Codigo"]);

        console.log('DataTable inicializada');
    }

    // ========================================================================
    // Cargar filtros desde PPL
    // ========================================================================
    function loadFiltros() {
        $$.loading(true);

        bound.execPPL("GetFiltros()").then(function(result) {
            filtrosData = transformData(result);
            console.log('Filtros cargados:', filtrosData.length);

            if (dataTable) {
                $$.setData(filtrosData, colsConfig);
            }

            $$.loading(false);
            clearSelection();
        }).catch(function(error) {
            $$.loading(false);
            console.error('Error cargando filtros:', error);
            showError('Error al cargar los filtros');
        });
    }

    // ========================================================================
    // Configurar event listeners
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
                showNotification('Seleccione un filtro para dar de baja', 'warning');
                return;
            }
            $('#delete-codigo').text(selectedData.Codigo + ' - ' + selectedData.Nombre);
            $('#modalDelete').modal('show');
        });

        $('#btn-modificacion').on('click', function() {
            if (!selectedData) {
                showNotification('Seleccione un filtro para modificar', 'warning');
                return;
            }
            showForm('modificacion', selectedData);
        });

        $('#btn-visualizacion').on('click', function() {
            if (!selectedData) {
                showNotification('Seleccione un filtro para visualizar', 'warning');
                return;
            }
            showForm('visualizacion', selectedData);
        });

        $('#btn-actualizar').on('click', function() {
            loadFiltros();
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

        // --- Modal: confirmar eliminacion ---
        $('#btn-confirm-delete').on('click', function() {
            deleteFiltro();
        });
    }

    // ========================================================================
    // Navegacion entre vistas
    // ========================================================================
    function showGrid() {
        formMode = null;
        clearForm();
        $('#view-form').hide();
        $('#view-grid').show();
    }

    function showForm(mode, data) {
        formMode = mode;
        clearForm();

        // Titulo e icono segun modo
        var titles = {
            'alta': 'Filtros - Alta',
            'modificacion': 'Filtros - Modificacion',
            'visualizacion': 'Filtros - Visualizacion'
        };
        var icons = {
            'alta': 'fas fa-plus-circle',
            'modificacion': 'fas fa-edit',
            'visualizacion': 'fas fa-eye'
        };

        $('#form-title').text(titles[mode] || 'Filtros');
        $('#form-icon').attr('class', icons[mode] || 'fas fa-filter');

        // Cargar datos si es modificacion o visualizacion
        if (data && (mode === 'modificacion' || mode === 'visualizacion')) {
            populateForm(data);
        }

        // Configurar campos segun modo
        setFormReadonly(mode === 'visualizacion');

        // En modificacion, codigo es readonly (es PK)
        if (mode === 'modificacion') {
            $('#fld-codigo').prop('readonly', true);
        }

        // Ocultar boton confirmar en visualizacion
        if (mode === 'visualizacion') {
            $('#btn-confirmar').hide();
        } else {
            $('#btn-confirmar').show();
        }

        // Resetear a la primera tab
        $('#tab-general').tab('show');

        $('#view-grid').hide();
        $('#view-form').show();

        // Foco en primer campo editable
        if (mode === 'alta') {
            $('#fld-codigo').focus();
        } else if (mode === 'modificacion') {
            $('#fld-nombre').focus();
        }
    }

    // ========================================================================
    // Formulario: poblar, limpiar, readonly, validar
    // ========================================================================
    function populateForm(data) {
        $('#fld-codigo').val(data.Codigo || '');
        $('#fld-nombre').val(data.Nombre || '');
        $('#fld-perfiles').val(data.Perfiles || '');
        $('#fld-tabla').val(data.Tabla || '');
        $('#fld-columnas').val(data.Columnas || '');
        $('#fld-condiciones').val(data.Condiciones || '');
        $('#fld-orden').val(data.Orden || '');
        $('#fld-nrinstancia').val(parseInt(data.NrInstancia, 10) || 0);
    }

    function clearForm() {
        $('#fld-codigo').val('');
        $('#fld-nombre').val('');
        $('#fld-perfiles').val('');
        $('#fld-tabla').val('');
        $('#fld-columnas').val('');
        $('#fld-condiciones').val('');
        $('#fld-orden').val('');
        $('#fld-nrinstancia').val(0);

        // Resetear estados
        $('#fld-codigo').prop('readonly', false);
        $('#fld-nombre').prop('readonly', false);
        $('#fld-perfiles').prop('readonly', false);
        $('#fld-tabla').prop('disabled', false);
        $('#fld-columnas').prop('readonly', false);
        $('#fld-condiciones').prop('readonly', false);
        $('#fld-orden').prop('readonly', false);
        $('#fld-nrinstancia').prop('readonly', false);
    }

    function setFormReadonly(readonly) {
        $('#fld-codigo').prop('readonly', readonly);
        $('#fld-nombre').prop('readonly', readonly);
        $('#fld-perfiles').prop('readonly', readonly);
        $('#fld-tabla').prop('disabled', readonly);
        $('#fld-columnas').prop('readonly', readonly);
        $('#fld-condiciones').prop('readonly', readonly);
        $('#fld-orden').prop('readonly', readonly);
        $('#fld-nrinstancia').prop('readonly', readonly);
    }

    function validateForm() {
        var codigo = $('#fld-codigo').val().trim();
        var nombre = $('#fld-nombre').val().trim();

        if (!codigo) {
            showNotification('El campo Codigo es obligatorio', 'warning');
            $('#tab-general').tab('show');
            $('#fld-codigo').focus();
            return false;
        }
        if (codigo.length > 6) {
            showNotification('El Codigo no puede tener mas de 6 caracteres', 'warning');
            $('#tab-general').tab('show');
            $('#fld-codigo').focus();
            return false;
        }
        if (!nombre) {
            showNotification('El campo Nombre es obligatorio', 'warning');
            $('#tab-general').tab('show');
            $('#fld-nombre').focus();
            return false;
        }
        return true;
    }

    // Escapar comillas simples para evitar inyeccion SQL en las llamadas PPL
    function escapeSql(value) {
        if (!value) return '';
        return value.replace(/'/g, "''");
    }

    // Normalizar perfiles al formato pipe-delimited: "TRADER|ADMIN|"
    // Acepta entrada separada por pipes, comas o espacios
    function normalizePerfiles(value) {
        if (!value) return '';
        // Separar por pipe, coma o coma+espacio
        var parts = value.split(/[|,]+/).map(function(p) { return p.trim().toUpperCase(); }).filter(function(p) { return p.length > 0; });
        if (parts.length === 0) return '';
        return parts.join('|') + '|';
    }

    // ========================================================================
    // Submit del formulario (Alta o Modificacion)
    // ========================================================================
    function submitForm() {
        if (!validateForm()) return;

        // Verificar codigo duplicado en modo alta
        if (formMode === 'alta') {
            var codigoCheck = $('#fld-codigo').val().trim().toUpperCase();
            var duplicado = filtrosData.some(function(f) {
                return f.Codigo && f.Codigo.trim().toUpperCase() === codigoCheck;
            });
            if (duplicado) {
                showNotification('Ya existe un filtro con el codigo <strong>' + codigoCheck + '</strong>. Use otro codigo o modifique el existente.', 'warning');
                $('#tab-general').tab('show');
                $('#fld-codigo').focus();
                return;
            }
        }

        var codigo = escapeSql($('#fld-codigo').val().trim().toUpperCase());
        var nombre = escapeSql($('#fld-nombre').val().trim());
        var perfiles = escapeSql(normalizePerfiles($('#fld-perfiles').val()));
        var tabla = escapeSql($('#fld-tabla').val() || '');
        var columnas = escapeSql($('#fld-columnas').val().trim());
        var condiciones = escapeSql($('#fld-condiciones').val().trim());
        var orden = escapeSql($('#fld-orden').val().trim());
        var nrInstancia = parseInt($('#fld-nrinstancia').val(), 10) || 0;

        $$.loading(true);

        var pplCode;
        if (formMode === 'alta') {
            pplCode = "InsertFiltro('" + codigo + "', '" + nombre + "', '" + perfiles + "', '"
                + tabla + "', '" + columnas + "', '" + condiciones + "', '" + orden + "', " + nrInstancia + ")";
        } else if (formMode === 'modificacion') {
            pplCode = "UpdateFiltro('" + codigo + "', '" + nombre + "', '" + perfiles + "', '"
                + tabla + "', '" + columnas + "', '" + condiciones + "', '" + orden + "', " + nrInstancia + ")";
        }

        bound.execPPL(pplCode).then(function(result) {
            $$.loading(false);

            var msg = formMode === 'alta'
                ? 'Filtro ' + codigo + ' creado correctamente'
                : 'Filtro ' + codigo + ' modificado correctamente';

            showNotification(msg, 'success');
            showGrid();
            loadFiltros();
        }).catch(function(error) {
            $$.loading(false);
            console.error('Error guardando filtro:', error);
            showError('Error al guardar el filtro: ' + (error.message || error));
        });
    }

    // ========================================================================
    // Eliminar filtro
    // ========================================================================
    function deleteFiltro() {
        if (!selectedData) return;

        var codigo = selectedData.Codigo;
        $('#modalDelete').modal('hide');
        $$.loading(true);

        bound.execPPL("DeleteFiltro('" + escapeSql(codigo) + "')").then(function(result) {
            $$.loading(false);
            showNotification('Filtro ' + codigo + ' eliminado correctamente', 'success');
            clearSelection();
            loadFiltros();
        }).catch(function(error) {
            $$.loading(false);
            console.error('Error eliminando filtro:', error);
            showError('Error al eliminar el filtro: ' + (error.message || error));
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
