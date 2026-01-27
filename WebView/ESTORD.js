/* ============================================================================
   JavaScript: Estado de Órdenes en Tiempo Real
   ============================================================================
   Lógica de interactividad, comunicación con backend PPL y actualizaciones
   ============================================================================ */

(function() {
    'use strict';

    // Variables globales
    let dataTable = null;
    let ordenesData = [];
    let updateInterval = null;

    // ========================================================================
    // Transformador de datos del backend
    // ========================================================================
    // El backend retorna arrays de objetos {key, value}, necesitamos convertirlos
    // a objetos planos {TipoOrden: "Compra", NroOrden: 1001, ...}
    function transformRow(row) {
        if (!row || !Array.isArray(row)) return row;

        const obj = {};
        row.forEach(function(item) {
            if (item && item.key !== undefined) {
                // Capitalizar la primera letra de cada palabra para mantener compatibilidad
                const key = capitalizeKey(item.key);
                // Trim de strings para quitar espacios en blanco extras
                obj[key] = typeof item.value === 'string' ? item.value.trim() : item.value;
            }
        });
        return obj;
    }

    function transformData(data) {
        if (!data) return [];

        // Si es un objeto con propiedad 'result', extraerla
        if (data.result && Array.isArray(data.result)) {
            data = data.result;
        }

        if (!Array.isArray(data)) return [];

        // Si el primer elemento es un array de {key, value}, transformar todo
        if (data.length > 0 && Array.isArray(data[0])) {
            return data.map(transformRow);
        }

        // Si ya es un array de objetos planos, solo hacer trim de strings
        return data.map(function(row) {
            if (row && typeof row === 'object' && !Array.isArray(row)) {
                const obj = {};
                Object.keys(row).forEach(function(key) {
                    const newKey = capitalizeKey(key);
                    obj[newKey] = typeof row[key] === 'string' ? row[key].trim() : row[key];
                });
                return obj;
            }
            return row;
        });
    }

    // Capitaliza la primera letra de cada palabra (tipoorden -> TipoOrden)
    function capitalizeKey(key) {
        if (!key) return key;
        // Mapeo directo para claves conocidas
        const keyMap = {
            'tipoorden': 'TipoOrden',
            'nroorden': 'NroOrden',
            'fechaorden': 'FechaOrden',
            'cliente': 'Cliente',
            'estado': 'Estado',
            'monto': 'Monto',
            'usuario': 'Usuario',
            'nroitem': 'NroItem',
            'especie': 'Especie',
            'cantidad': 'Cantidad',
            'precio': 'Precio',
            'importe': 'Importe',
            'comision': 'Comision',
            'totalordenes': 'TotalOrdenes',
            'pendientes': 'Pendientes',
            'ejecutadas': 'Ejecutadas',
            'canceladas': 'Canceladas',
            'montototal': 'MontoTotal',
            'montopromedio': 'MontoPromedio'
        };

        const lowerKey = key.toLowerCase();
        if (keyMap[lowerKey]) {
            return keyMap[lowerKey];
        }

        // Fallback: capitalizar primera letra
        return key.charAt(0).toUpperCase() + key.slice(1);
    }

    // ========================================================================
    // Configuración de DataTable
    // ========================================================================
    const colsConfig = [
        {
            "className": 'details-control',
            "orderable": false,
            "data": null,
            "defaultContent": ''
        },
        {
            "data": "TipoOrden",
            "title": "Tipo"
        },
        {
            "data": "NroOrden",
            "title": "Nro. Orden"
        },
        {
            "data": "FechaOrden",
            "title": "Fecha"
        },
        {
            "data": "Cliente",
            "title": "Cliente"
        },
        {
            "data": "Estado",
            "title": "Estado",
            "render": function(data, type, row) {
                if (type === 'display') {
                    let badgeClass = 'badge-pendiente';
                    if (data === 'Ejecutada') {
                        badgeClass = 'badge-ejecutada';
                    } else if (data === 'Cancelada') {
                        badgeClass = 'badge-cancelada';
                    }
                    return '<span class="badge badge-estado ' + badgeClass + '">' + data + '</span>';
                }
                return data;
            }
        },
        {
            "data": "Monto",
            "title": "Monto",
            "render": function(data, type, row) {
                if (type === 'display') {
                    return $$.numberFormat(data, 2, true, false);
                }
                return data;
            }
        },
        {
            "data": "Usuario",
            "title": "Usuario"
        }
    ];

    // ========================================================================
    // Inicialización
    // ========================================================================
    function init() {
        console.log('Inicializando WebView de Órdenes...');

        // Obtener datos iniciales desde el Scope PPL
        loadInitialData();

        // Inicializar DataTable
        initDataTable();

        // Cargar estadísticas
        loadStatistics();

        // Configurar event listeners
        setupEventListeners();

        // Configurar actualización en tiempo real
        setupRealtimeUpdates();

        console.log('WebView inicializada correctamente');
    }

    // ========================================================================
    // Cargar datos iniciales desde PPL
    // ========================================================================
    function loadInitialData() {
        bound.execPPL("GetOrdenes()").then(function(result) {
            ordenesData = transformData(result);
            console.log('Órdenes cargadas:', ordenesData.length);

            if (dataTable) {
                $$.setData(ordenesData, colsConfig);
            }
        }).catch(function(error) {
            console.error('Error cargando órdenes:', error);
            showError('Error al cargar las órdenes');
        });
    }

    // ========================================================================
    // Inicializar DataTable
    // ========================================================================
    function initDataTable() {
        const dtSelector = '#dt1';

        dataTable = $(dtSelector).DataTable({
            scrollX: true,
            searching: true,
            lengthChange: true,
            pageLength: 25,
            data: ordenesData,
            columns: colsConfig,
            language: {
                zeroRecords: "No se encontraron órdenes",
                info: "Mostrando página _PAGE_ de _PAGES_",
                infoEmpty: "",
                infoFiltered: "(Filtrado de un total de _MAX_ registros)",
                search: "Buscar:",
                lengthMenu: "Mostrar _MENU_ registros",
                paginate: {
                    first: "Primera",
                    last: "Última",
                    next: "Siguiente >",
                    previous: "< Anterior"
                }
            },
            order: [[2, 'desc']], // Ordenar por NroOrden descendente
            rowCallback: function(row, data, index) {
                // Agregar atributo data para facilitar búsqueda
                $(row).attr('data-nro-orden', data.NroOrden);
            }
        });

        // Guardar referencia en librería $$
        $$.setDataTable(dataTable, dtSelector);

        // Definir claves para actualización
        $$.setKeyNames(["NroOrden"]);

        // Construir filtros automáticos
        buildCustomFilters();

        console.log('DataTable inicializada');
    }

    // ========================================================================
    // Construir filtros personalizados
    // ========================================================================
    function buildCustomFilters() {
        // Filtro de Tipo de Orden
        bound.execPPL("GetTiposOrden()").then(function(result) {
            const tipos = transformData(result);
            const filterTipo = $('#filter-0');
            filterTipo.empty();
            filterTipo.append('<a class="dropdown-item" href="#" data-value="">Todos</a>');

            tipos.forEach(function(tipo) {
                const tipoOrden = tipo.TipoOrden || tipo.Tipoorden;
                const item = $('<a class="dropdown-item" href="#" data-value="' + tipoOrden + '">' + tipoOrden + '</a>');
                item.on('click', function(e) {
                    e.preventDefault();
                    const value = $(this).data('value');
                    dataTable.column(1).search(value).draw();
                    $('#dropdownTipo').text(value || 'Todos los tipos');
                });
                filterTipo.append(item);
            });
        });

        // Filtro de Estado
        bound.execPPL("GetEstados()").then(function(result) {
            const estados = transformData(result);
            const filterEstado = $('#filter-4');
            filterEstado.empty();
            filterEstado.append('<a class="dropdown-item" href="#" data-value="">Todos</a>');

            estados.forEach(function(estado) {
                const estadoVal = estado.Estado;
                const item = $('<a class="dropdown-item" href="#" data-value="' + estadoVal + '">' + estadoVal + '</a>');
                item.on('click', function(e) {
                    e.preventDefault();
                    const value = $(this).data('value');
                    dataTable.column(5).search(value).draw();
                    $('#dropdownEstado').text(value || 'Todos los estados');
                });
                filterEstado.append(item);
            });
        });
    }

    // ========================================================================
    // Cargar estadísticas
    // ========================================================================
    function loadStatistics() {
        bound.execPPL("GetEstadisticas()").then(function(result) {
            // GetEstadisticas retorna un solo objeto (la primera fila)
            let stats = result;

            // Si viene como array de {key, value}, transformar
            if (Array.isArray(result) && result.length > 0) {
                if (Array.isArray(result[0])) {
                    // Es array de arrays (múltiples filas en formato key/value)
                    stats = transformRow(result[0]);
                } else if (result[0].key !== undefined) {
                    // Es un array de {key, value} directamente
                    stats = transformRow(result);
                } else {
                    // Ya es un objeto plano o array de objetos
                    stats = result[0] || result;
                }
            }

            if (!stats) return;

            $('#stat-total').text(stats.TotalOrdenes || 0);
            $('#stat-pendientes').text(stats.Pendientes || 0);
            $('#stat-ejecutadas').text(stats.Ejecutadas || 0);

            const montoFormatted = $$.numberFormat(stats.MontoTotal || 0, 2, false, false);
            $('#stat-monto').text('$' + montoFormatted);
        }).catch(function(error) {
            console.error('Error cargando estadísticas:', error);
        });
    }

    // ========================================================================
    // Configurar event listeners
    // ========================================================================
    function setupEventListeners() {
        // Botón de actualizar
        $('#btn-refresh').on('click', function() {
            refreshData();
        });

        // Click en fila para expandir detalle
        $('#dt1 tbody').on('click', 'td.details-control', function() {
            const tr = $(this).closest('tr');
            const row = dataTable.row(tr);

            if (row.child.isShown()) {
                // Cerrar detalle
                row.child.hide();
                tr.removeClass('shown');
            } else {
                // Abrir detalle
                const nroOrden = row.data().NroOrden;
                loadDetalleOrden(nroOrden, row, tr);
            }
        });

        // Doble click en fila para abrir modal
        $('#dt1 tbody').on('dblclick', 'tr', function() {
            const row = dataTable.row(this);
            const nroOrden = row.data().NroOrden;
            openModalDetalle(nroOrden);
        });
    }

    // ========================================================================
    // Cargar detalle de orden (expandible)
    // ========================================================================
    function loadDetalleOrden(nroOrden, row, tr) {
        $$.loading(true);

        bound.execPPL("GetDetalleOrden(" + nroOrden + ")").then(function(result) {
            $$.loading(false);

            const detalle = transformData(result);

            if (!detalle || detalle.length === 0) {
                row.child('<div class="p-3">No hay detalle disponible para esta orden</div>').show();
                tr.addClass('shown');
                return;
            }

            // Construir HTML del detalle
            let html = '<table class="table table-sm table-bordered mb-0">';
            html += '<thead><tr>';
            html += '<th>Item</th><th>Especie</th><th>Cantidad</th><th>Precio</th><th>Importe</th><th>Comisión</th>';
            html += '</tr></thead><tbody>';

            detalle.forEach(function(item) {
                html += '<tr>';
                html += '<td>' + item.NroItem + '</td>';
                html += '<td>' + item.Especie + '</td>';
                html += '<td>' + $$.numberFormat(item.Cantidad, 2, false, false) + '</td>';
                html += '<td>' + $$.numberFormat(item.Precio, 2, false, false) + '</td>';
                html += '<td>' + $$.numberFormat(item.Importe, 2, false, false) + '</td>';
                html += '<td>' + $$.numberFormat(item.Comision, 2, false, false) + '</td>';
                html += '</tr>';
            });

            html += '</tbody></table>';

            row.child(html).show();
            tr.addClass('shown');
        }).catch(function(error) {
            $$.loading(false);
            console.error('Error cargando detalle:', error);
            showError('Error al cargar el detalle de la orden');
        });
    }

    // ========================================================================
    // Abrir modal con detalle completo
    // ========================================================================
    function openModalDetalle(nroOrden) {
        $('#modal-nro-orden').text(nroOrden);
        $('#modalDetalle').modal('show');

        bound.execPPL("GetDetalleOrden(" + nroOrden + ")").then(function(result) {
            const detalle = transformData(result);
            const tbody = $('#dt-detalle tbody');
            tbody.empty();

            if (!detalle || detalle.length === 0) {
                tbody.append('<tr><td colspan="6" class="text-center">No hay detalle disponible</td></tr>');
                return;
            }

            detalle.forEach(function(item) {
                const row = '<tr>' +
                    '<td>' + item.NroItem + '</td>' +
                    '<td>' + item.Especie + '</td>' +
                    '<td class="text-right">' + $$.numberFormat(item.Cantidad, 2, false, false) + '</td>' +
                    '<td class="text-right">' + $$.numberFormat(item.Precio, 2, false, false) + '</td>' +
                    '<td class="text-right">' + $$.numberFormat(item.Importe, 2, false, false) + '</td>' +
                    '<td class="text-right">' + $$.numberFormat(item.Comision, 2, false, false) + '</td>' +
                    '</tr>';
                tbody.append(row);
            });
        }).catch(function(error) {
            console.error('Error cargando detalle en modal:', error);
        });
    }

    // ========================================================================
    // Refrescar datos
    // ========================================================================
    function refreshData() {
        $$.loading(true);

        bound.execPPL("GetOrdenes()").then(function(result) {
            ordenesData = transformData(result);
            $$.setData(ordenesData, colsConfig);
            loadStatistics();
            $$.loading(false);

            // Mostrar notificación
            showNotification('Datos actualizados correctamente');
        }).catch(function(error) {
            $$.loading(false);
            console.error('Error actualizando datos:', error);
            showError('Error al actualizar los datos');
        });
    }

    // ========================================================================
    // Configurar actualización en tiempo real vía FPA Hub
    // ========================================================================
    function setupRealtimeUpdates() {
        // Suscribirse a eventos de actualización
        bound.subscribe('OrdenActualizada', function(data) {
            console.log('Notificación recibida:', data);

            // Actualizar datos automáticamente
            refreshData();

            // Mostrar notificación
            showNotification('Nueva orden actualizada en el sistema');
        });

        // También actualizar cada 30 segundos como backup
        updateInterval = setInterval(function() {
            console.log('Auto-refresh cada 30s');
            refreshData();
        }, 30000);
    }

    // ========================================================================
    // Utilidades
    // ========================================================================
    function showNotification(message) {
        // Crear toast o notificación simple
        const notification = $('<div class="alert alert-info alert-dismissible fade show position-fixed" role="alert" style="top: 20px; right: 20px; z-index: 9999;">')
            .html(message + '<button type="button" class="close" data-dismiss="alert"><span>&times;</span></button>');

        $('body').append(notification);

        setTimeout(function() {
            notification.alert('close');
        }, 3000);
    }

    function showError(message) {
        const notification = $('<div class="alert alert-danger alert-dismissible fade show position-fixed" role="alert" style="top: 20px; right: 20px; z-index: 9999;">')
            .html('<strong>Error:</strong> ' + message + '<button type="button" class="close" data-dismiss="alert"><span>&times;</span></button>');

        $('body').append(notification);

        setTimeout(function() {
            notification.alert('close');
        }, 5000);
    }

    // ========================================================================
    // Cleanup al cerrar
    // ========================================================================
    window.addEventListener('beforeunload', function() {
        if (updateInterval) {
            clearInterval(updateInterval);
        }
    });

    // ========================================================================
    // Iniciar cuando el DOM esté listo
    // ========================================================================
    $(document).ready(function() {
        init();
    });

})();
