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
        bound.execPPL("VAR('ORDENES')").then(function(result) {
            ordenesData = result || [];
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
        bound.execPPL("VAR('TIPOS_ORDEN')").then(function(tipos) {
            const filterTipo = $('#filter-0');
            filterTipo.empty();
            filterTipo.append('<a class="dropdown-item" href="#" data-value="">Todos</a>');

            tipos.forEach(function(tipo) {
                const item = $('<a class="dropdown-item" href="#" data-value="' + tipo.TipoOrden + '">' + tipo.TipoOrden + '</a>');
                item.on('click', function(e) {
                    e.preventDefault();
                    const value = $(this).data('value');
                    dataTable.column(1).search(value).draw();
                    $('#dropdownTipo').text(tipo.TipoOrden || 'Todos los tipos');
                });
                filterTipo.append(item);
            });
        });

        // Filtro de Estado
        bound.execPPL("VAR('ESTADOS')").then(function(estados) {
            const filterEstado = $('#filter-4');
            filterEstado.empty();
            filterEstado.append('<a class="dropdown-item" href="#" data-value="">Todos</a>');

            estados.forEach(function(estado) {
                const item = $('<a class="dropdown-item" href="#" data-value="' + estado.Estado + '">' + estado.Estado + '</a>');
                item.on('click', function(e) {
                    e.preventDefault();
                    const value = $(this).data('value');
                    dataTable.column(5).search(value).draw();
                    $('#dropdownEstado').text(estado.Estado || 'Todos los estados');
                });
                filterEstado.append(item);
            });
        });
    }

    // ========================================================================
    // Cargar estadísticas
    // ========================================================================
    function loadStatistics() {
        bound.execPPL("VAR('STATS')").then(function(stats) {
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

        bound.execPPL("GetDetalleOrden(" + nroOrden + ")").then(function(detalle) {
            $$.loading(false);

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

        bound.execPPL("GetDetalleOrden(" + nroOrden + ")").then(function(detalle) {
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

        bound.execPPL("GetOrdenes()").then(function(ordenes) {
            ordenesData = ordenes || [];
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
