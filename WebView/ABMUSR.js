/* ============================================================================
   JavaScript: ABM de Usuarios
   ============================================================================
   Logica de interactividad y comunicacion con backend PPL para Alta, Baja
   y Modificacion de usuarios del sistema.
   ============================================================================ */

(function() {
    'use strict';

    // Variables globales
    var dataTable = null;
    var usuariosData = [];
    var perfilesData = [];
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
            'jerarquia': 'Jerarquia',
            'codigo': 'Codigo',
            'nombre': 'Nombre',
            'perfil': 'Perfil',
            'perfildescripcion': 'PerfilDescripcion'
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
            "data": "Jerarquia",
            "title": "Jerarquía"
        },
        {
            "data": "Codigo",
            "title": "Código"
        },
        {
            "data": "Nombre",
            "title": "Nombre"
        },
        {
            "data": "Perfil",
            "title": "Perfiles",
            "render": function(data, type, row) {
                if (type === 'display' && row.PerfilDescripcion) {
                    return data + ' - ' + row.PerfilDescripcion;
                }
                return data;
            }
        }
    ];

    // ========================================================================
    // Inicializacion
    // ========================================================================
    function init() {
        console.log('Inicializando WebView ABM de Usuarios...');

        initDataTable();
        loadUsuarios();
        loadPerfiles();
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
            data: usuariosData,
            columns: colsConfig,
            language: {
                zeroRecords: "No se encontraron usuarios",
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
            order: [[1, 'asc']] // Ordenar por Codigo ascendente
        });

        $$.setDataTable(dataTable, dtSelector);
        $$.setKeyNames(["Codigo"]);

        console.log('DataTable inicializada');
    }

    // ========================================================================
    // Cargar usuarios desde PPL
    // ========================================================================
    function loadUsuarios() {
        $$.loading(true);

        bound.execPPL("GetUsuarios()").then(function(result) {
            usuariosData = transformData(result);
            console.log('Usuarios cargados:', usuariosData.length);

            if (dataTable) {
                $$.setData(usuariosData, colsConfig);
            }

            $$.loading(false);
            clearSelection();
        }).catch(function(error) {
            $$.loading(false);
            console.error('Error cargando usuarios:', error);
            showError('Error al cargar los usuarios');
        });
    }

    // ========================================================================
    // Cargar perfiles para el combo
    // ========================================================================
    function loadPerfiles() {
        bound.execPPL("GetPerfiles()").then(function(result) {
            perfilesData = transformData(result);
            console.log('Perfiles cargados:', perfilesData.length);

            var select = $('#fld-perfil');
            select.find('option:not(:first)').remove();

            perfilesData.forEach(function(perfil) {
                select.append(
                    $('<option></option>')
                        .val(perfil.Codigo)
                        .text(perfil.Codigo)
                        .data('descripcion', perfil.Nombre)
                );
            });
        }).catch(function(error) {
            console.error('Error cargando perfiles:', error);
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
                showNotification('Seleccione un usuario para dar de baja', 'warning');
                return;
            }
            $('#delete-codigo').text(selectedData.Codigo);
            $('#modalDelete').modal('show');
        });

        $('#btn-modificacion').on('click', function() {
            if (!selectedData) {
                showNotification('Seleccione un usuario para modificar', 'warning');
                return;
            }
            showForm('modificacion', selectedData);
        });

        $('#btn-visualizacion').on('click', function() {
            if (!selectedData) {
                showNotification('Seleccione un usuario para visualizar', 'warning');
                return;
            }
            showForm('visualizacion', selectedData);
        });

        $('#btn-actualizar').on('click', function() {
            loadUsuarios();
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

        // --- Combo perfil: mostrar descripcion ---
        $('#fld-perfil').on('change', function() {
            var selected = $(this).find(':selected');
            var desc = selected.data('descripcion') || '';
            $('#lbl-perfil-desc').text(desc);
        });

        // --- Modal: confirmar eliminacion ---
        $('#btn-confirm-delete').on('click', function() {
            deleteUsuario();
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
            'alta': 'Usuarios - Alta',
            'modificacion': 'Usuarios - Modificación',
            'visualizacion': 'Usuarios - Visualización'
        };
        var icons = {
            'alta': 'fas fa-user-plus',
            'modificacion': 'fas fa-user-edit',
            'visualizacion': 'fas fa-user'
        };

        $('#form-title').text(titles[mode] || 'Usuarios');
        $('#form-icon').attr('class', icons[mode] || 'fas fa-user');

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

        $('#view-grid').hide();
        $('#view-form').show();

        // Foco en primer campo editable
        if (mode === 'alta') {
            $('#fld-jerarquia').focus();
        } else if (mode === 'modificacion') {
            $('#fld-nombre').focus();
        }
    }

    // ========================================================================
    // Formulario: poblar, limpiar, readonly, validar
    // ========================================================================
    function populateForm(data) {
        $('#fld-jerarquia').val(data.Jerarquia || '');
        $('#fld-codigo').val(data.Codigo || '');
        $('#fld-nombre').val(data.Nombre || '');
        $('#fld-perfil').val(data.Perfil || '');
        $('#lbl-perfil-desc').text(data.PerfilDescripcion || '');
    }

    function clearForm() {
        $('#fld-jerarquia').val('');
        $('#fld-codigo').val('');
        $('#fld-nombre').val('');
        $('#fld-perfil').val('');
        $('#lbl-perfil-desc').text('');

        // Resetear estados
        $('#fld-jerarquia').prop('readonly', false);
        $('#fld-codigo').prop('readonly', false);
        $('#fld-nombre').prop('readonly', false);
        $('#fld-perfil').prop('disabled', false);
    }

    function setFormReadonly(readonly) {
        $('#fld-jerarquia').prop('readonly', readonly);
        $('#fld-codigo').prop('readonly', readonly);
        $('#fld-nombre').prop('readonly', readonly);
        $('#fld-perfil').prop('disabled', readonly);
    }

    function validateForm() {
        var jerarquia = $('#fld-jerarquia').val().trim();
        var codigo = $('#fld-codigo').val().trim();
        var nombre = $('#fld-nombre').val().trim();

        if (!jerarquia) {
            showNotification('El campo Jerarquía es obligatorio', 'warning');
            $('#fld-jerarquia').focus();
            return false;
        }
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

        var jerarquia = $('#fld-jerarquia').val().trim();
        var codigo = $('#fld-codigo').val().trim();
        var nombre = $('#fld-nombre').val().trim();
        var perfil = $('#fld-perfil').val() || '';

        $$.loading(true);

        var pplCode;
        if (formMode === 'alta') {
            pplCode = "InsertUsuario('" + jerarquia + "', '" + codigo + "', '" + nombre + "', '" + perfil + "')";
        } else if (formMode === 'modificacion') {
            pplCode = "UpdateUsuario('" + codigo + "', '" + jerarquia + "', '" + nombre + "', '" + perfil + "')";
        }

        bound.execPPL(pplCode).then(function(result) {
            $$.loading(false);

            var msg = formMode === 'alta'
                ? 'Usuario ' + codigo + ' creado correctamente'
                : 'Usuario ' + codigo + ' modificado correctamente';

            showNotification(msg, 'success');
            showGrid();
            loadUsuarios();
        }).catch(function(error) {
            $$.loading(false);
            console.error('Error guardando usuario:', error);
            showError('Error al guardar el usuario: ' + error.message);
        });
    }

    // ========================================================================
    // Eliminar usuario
    // ========================================================================
    function deleteUsuario() {
        if (!selectedData) return;

        var codigo = selectedData.Codigo;
        $('#modalDelete').modal('hide');
        $$.loading(true);

        bound.execPPL("DeleteUsuario('" + codigo + "')").then(function(result) {
            $$.loading(false);
            showNotification('Usuario ' + codigo + ' eliminado correctamente', 'success');
            clearSelection();
            loadUsuarios();
        }).catch(function(error) {
            $$.loading(false);
            console.error('Error eliminando usuario:', error);
            showError('Error al eliminar el usuario: ' + error.message);
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
    // Prevenir navegación no deseada dentro del iframe
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
