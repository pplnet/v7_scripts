/* ============================================================================
   JavaScript: Monitor de Notificaciones en Tiempo Real (MNTNTF)
   ============================================================================
   Se conecta al Hub SignalR y escucha TODAS las notificaciones que emite el
   sistema:
     - Firehose "__NOTIF_ALL__": toda notificacion PPL (seccion NOTIFICACION /
       funcion Notificar). El messageCode es el GRUPO real; el payload puede ser
       plano, un sobre {v,grupo,id,severidad,mensaje,datos} o un batch coalescido
       {coalesced,grupo,items[]}.
     - Grupo del usuario "user:{CODIGO}" (auto-unido en OnConnectedAsync): eventos
       de proceso (PROCESS_COMPLETED/_ERROR/_CANCELLED/_MESSAGE) y de mensajeria
       (NOTIFICATION_NEW/_DELETED/_READ).

   Endpoint del Hub: https://localhost:44300/hubs/ppl
   ============================================================================ */

(function () {
    'use strict';

    // ----------------------------------------------------------------------
    // Config
    // ----------------------------------------------------------------------
    const API_BASE_URL = window.API_BASE_URL || 'https://localhost:44300';
    const HUB_URL = API_BASE_URL + '/hubs/ppl';
    const FIREHOSE_GROUP = '__NOTIF_ALL__';
    const MAX_ROWS = 1000;               // buffer maximo de filas
    const RECONNECT_DELAY_MS = 3000;
    const MAX_RECONNECT_ATTEMPTS = 20;

    // ----------------------------------------------------------------------
    // Estado
    // ----------------------------------------------------------------------
    let dataTable = null;
    let hubConnection = null;
    let reconnectAttempts = 0;
    let paused = false;
    let seq = 0;
    const stats = { total: 0, info: 0, warning: 0, error: 0, procesos: 0 };
    const knownTipos = {};               // set de tipos vistos (para el filtro)

    // Codigos de proceso conocidos -> severidad por defecto
    const PROCESS_SEVERITY = {
        'PROCESS_COMPLETED': 'info',
        'PROCESS_MESSAGE': 'info',
        'PROCESS_MESSAGEBOX_REQUEST': 'warning',
        'PROCESS_CANCELLED': 'warning',
        'PROCESS_ERROR': 'error'
    };

    // Codigos que el monitor IGNORA. PROCESS_WARNING son los warnings de CONDICIONES de una
    // operacion: no impiden crearla ni editarla (el usuario los confirma y sigue), asi que no
    // son una notificacion del sistema y no deben ensuciar el monitor ni el conteo.
    const IGNORED_CODES = { 'PROCESS_WARNING': 1 };

    // Codigos de mensajeria/chat que emite el backend (server-only en PPLHub).
    // NOTIFICATION_* llegan por los grupos de chat (user:/channel:/op:/profile:);
    // OP_UNREAD por channel:global (aviso liviano de mensaje nuevo en una op).
    const CHAT_CODES = ['NOTIFICATION_NEW', 'NOTIFICATION_DELETED', 'NOTIFICATION_READ', 'OP_UNREAD'];

    // Dedup de re-entregas multi-grupo (ej. un mensaje de canal que ademas te
    // menciona llega por channel:{id} Y por user:{code}). key = code#id -> ts.
    const _recentChat = {};

    // ======================================================================
    // Utilidades
    // ======================================================================
    function nowLabel() {
        const d = new Date();
        const p = function (n) { return (n < 10 ? '0' : '') + n; };
        return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function safeJson(obj) {
        try {
            return JSON.stringify(obj, null, 2);
        } catch (e) {
            return String(obj);
        }
    }

    // Busca (case-insensitive) la primera clave presente en un objeto.
    function pick(obj, keys) {
        if (!obj || typeof obj !== 'object') return undefined;
        const lower = {};
        Object.keys(obj).forEach(function (k) { lower[k.toLowerCase()] = obj[k]; });
        for (let i = 0; i < keys.length; i++) {
            const v = lower[keys[i].toLowerCase()];
            if (v !== undefined && v !== null && v !== '') return v;
        }
        return undefined;
    }

    // Normaliza el resultado de bound.execPPL(QueryTable(...)) a un array de objetos
    // con claves en minuscula. Tolera { result: [...] }, filas como array de
    // {key,value} y filas como objeto plano.
    function rowsFromResult(result) {
        let data = result;
        if (data && data.result && Array.isArray(data.result)) data = data.result;
        if (!Array.isArray(data)) return [];
        return data.map(function (row) {
            const obj = {};
            if (Array.isArray(row)) {
                row.forEach(function (item) {
                    if (item && item.key !== undefined) {
                        obj[String(item.key).toLowerCase()] =
                            typeof item.value === 'string' ? item.value.trim() : item.value;
                    }
                });
            } else if (row && typeof row === 'object') {
                Object.keys(row).forEach(function (k) {
                    obj[k.toLowerCase()] = typeof row[k] === 'string' ? row[k].trim() : row[k];
                });
            }
            return obj;
        });
    }

    // ======================================================================
    // Normalizacion de notificaciones -> filas del monitor
    // ======================================================================
    // Retorna un ARRAY de filas (un batch coalescido genera varias).
    function toRows(messageCode, payload) {
        const code = messageCode || '(sin codigo)';

        // 0) Codigos que no son notificaciones del sistema (ver IGNORED_CODES)
        if (IGNORED_CODES[code]) return [];

        // 1) Eventos de proceso (grupo user:{codigo})
        if (code.indexOf('PROCESS_') === 0) {
            return [buildRow({
                tipo: 'Proceso',
                origen: code,
                grupo: '(usuario)',
                severidad: PROCESS_SEVERITY[code] || 'info',
                mensaje: procesoMensaje(code, payload),
                datos: payload
            })];
        }

        // 2) Mensajeria / chat. Llega por los grupos de chat suscriptos
        // (channel:global / channel:{id} / user:{codigo}). Se dedupea la
        // re-entrega multi-grupo (canal + mencion) por id de mensaje.
        if (CHAT_CODES.indexOf(code) !== -1) {
            if (isDuplicateChat(code, payload)) return [];
            return [chatRow(code, payload)];
        }

        // 3) Firehose: messageCode = nombre del grupo real. Payload plano / sobre / batch.
        // 3a) Batch coalescido: { coalesced:true, grupo, items:[...] }
        if (payload && typeof payload === 'object' && Array.isArray(payload.items) &&
            (payload.coalesced === true || payload.grupo !== undefined)) {
            const grupo = payload.grupo || code;
            return payload.items.map(function (item) {
                return itemToRow(grupo, code, item);
            });
        }

        // 3b) Notificacion individual (sobre o plana)
        return [itemToRow(code, code, payload)];
    }

    // Convierte un item de notificacion PPL (sobre o plano) en fila.
    function itemToRow(grupo, origen, item) {
        // Sobre: { v, grupo, id, severidad, mensaje, datos }
        const severidad = normSeveridad(
            pick(item, ['severidad', '_sev', 'severity']) || 'info'
        );
        const mensaje = pick(item, ['mensaje', '_msg', 'message', 'texto', 'text', 'descripcion']);
        const datos = (item && typeof item === 'object' && item.datos !== undefined) ? item.datos : item;
        const g = (item && item.grupo) ? item.grupo : grupo;

        return buildRow({
            tipo: clasificarTipo(g, origen, datos),
            origen: origen,
            grupo: g,
            severidad: severidad,
            mensaje: mensaje || ('Notificacion: ' + g),
            datos: item
        });
    }

    function buildRow(r) {
        seq += 1;
        return {
            id: seq,
            hora: nowLabel(),
            ts: Date.now(),
            tipo: r.tipo,
            origen: r.origen,
            grupo: r.grupo || '',
            severidad: r.severidad || 'info',
            mensaje: r.mensaje || '',
            datos: r.datos
        };
    }

    // Vocabulario del monitor: info / warning / error.
    // El `_sev` de las notificaciones PPL ya llega normalizado y validado por el backend (un valor
    // fuera del vocabulario se anula alla y llega como 'info'), asi que los alias de aca son para
    // las OTRAS fuentes que muestra el monitor: 'alert' es el MessageDto.Type del chat.
    function normSeveridad(s) {
        s = String(s || '').toLowerCase();
        if (s === 'error' || s === 'alerta' || s === 'alert' || s === 'critical' || s === 'critico') return 'error';
        if (s === 'warning' || s === 'warn' || s === 'advertencia' || s === 'aviso') return 'warning';
        return 'info';
    }

    // Convierte un evento de chat/mensajeria en una fila coherente del monitor.
    // NOTIFICATION_NEW → payload es un MessageDto (Usuario/Message/ChannelName/Type).
    function chatRow(code, payload) {
        let grupo, severidad, mensaje;
        const usuario = pick(payload, ['usuario', 'user', 'autor']);

        if (code === 'NOTIFICATION_NEW') {
            const canal = pick(payload, ['channelName', 'canalnombre', 'canal']);
            const texto = pick(payload, ['message', 'mensaje', 'texto', 'contenido', 'text']);
            grupo = canal || 'General';
            severidad = normSeveridad(pick(payload, ['type', 'severidad']) || 'info');
            mensaje = (usuario ? usuario + ': ' : '') + (texto || '(mensaje sin texto)');
        } else if (code === 'OP_UNREAD') {
            const nr = pick(payload, ['nr', 'nroperacion']);
            grupo = nr ? ('Op ' + nr) : 'Operacion';
            severidad = 'info';
            mensaje = 'Nuevo mensaje en la operacion ' + (nr || '?') +
                (usuario ? ' (de ' + usuario + ')' : '');
        } else if (code === 'NOTIFICATION_DELETED') {
            const mid = pick(payload, ['messageid', 'id']);
            grupo = 'Chat';
            severidad = 'warning';
            mensaje = 'Mensaje eliminado' + (mid ? ' (id ' + mid + ')' : '');
        } else if (code === 'NOTIFICATION_READ') {
            const by = pick(payload, ['seenby', 'usuario']);
            grupo = 'Chat';
            severidad = 'info';
            mensaje = 'Mensajes marcados como leidos' + (by ? ' por ' + by : '');
        } else {
            grupo = 'Chat';
            severidad = 'info';
            mensaje = code;
        }

        return buildRow({
            tipo: 'Mensaje',
            origen: code,
            grupo: grupo,
            severidad: severidad,
            mensaje: mensaje,
            datos: payload
        });
    }

    // Evita filas duplicadas cuando el MISMO mensaje llega por dos grupos a los
    // que el monitor esta suscripto (ej. canal + mencion). Dedup por (code,id) en
    // una ventana corta; los eventos sin id (OP_UNREAD/READ) nunca se dedupean.
    function isDuplicateChat(code, payload) {
        const id = pick(payload, ['id', 'messageid']);
        if (id === undefined) return false;
        const key = code + '#' + id;
        const now = Date.now();
        const prev = _recentChat[key];
        _recentChat[key] = now;
        const keys = Object.keys(_recentChat);
        if (keys.length > 500) {
            keys.forEach(function (k) { if (now - _recentChat[k] > 30000) delete _recentChat[k]; });
        }
        return prev !== undefined && (now - prev) < 5000;
    }

    // Heuristica de "tipo" segun el nombre del grupo / contenido.
    function clasificarTipo(grupo, origen, datos) {
        const g = String(grupo || origen || '').toLowerCase();
        if (/(oper|orden|trans|minut|opmin)/.test(g)) return 'Operacion';
        if (/(msg|chat|mensaj)/.test(g)) return 'Mensaje';
        return 'Notificacion';
    }

    function procesoMensaje(code, payload) {
        if (code === 'PROCESS_COMPLETED') return 'Proceso completado' + procId(payload);
        if (code === 'PROCESS_CANCELLED') return 'Proceso cancelado' + procId(payload);
        if (code === 'PROCESS_ERROR') {
            const e = pick(payload, ['error', 'message', 'mensaje']);
            return 'Error de proceso' + (e ? ': ' + e : procId(payload));
        }
        if (code === 'PROCESS_MESSAGE') {
            return pick(payload, ['message', 'mensaje', 'text', 'texto']) || 'Mensaje de proceso';
        }
        if (code === 'PROCESS_MESSAGEBOX_REQUEST') {
            return pick(payload, ['message', 'mensaje']) || 'Solicitud de confirmacion';
        }
        return code;
    }

    function procId(payload) {
        const p = pick(payload, ['processId', 'processid', 'ProcessId']);
        return p ? ' (' + p + ')' : '';
    }

    // ======================================================================
    // DataTable
    // ======================================================================
    const colsConfig = [
        { className: 'details-control', orderable: false, data: null, defaultContent: '' },
        { data: 'hora', title: 'Hora' },
        {
            data: 'tipo', title: 'Tipo',
            render: function (d, type) {
                if (type !== 'display') return d;
                const cls = 'tipo-' + String(d).toLowerCase();
                return '<span class="badge-tipo ' + cls + '">' + escapeHtml(d) + '</span>';
            }
        },
        { data: 'origen', title: 'Origen' },
        { data: 'grupo', title: 'Grupo' },
        {
            data: 'severidad', title: 'Severidad',
            render: function (d, type) {
                if (type !== 'display') return d;
                return '<span class="badge-sev badge-' + escapeHtml(d) + '">' + escapeHtml(d) + '</span>';
            }
        },
        {
            data: 'mensaje', title: 'Mensaje',
            render: function (d, type) {
                if (type !== 'display') return d;
                const s = String(d || '');
                return escapeHtml(s.length > 120 ? s.slice(0, 120) + '…' : s);
            }
        }
    ];

    function initDataTable() {
        dataTable = $('#dt1').DataTable({
            data: [],
            columns: colsConfig,
            order: [[1, 'desc']],
            deferRender: true,
            pageLength: 25,
            rowId: 'id',
            language: {
                zeroRecords: 'Sin notificaciones aun. Esperando eventos en tiempo real…',
                info: 'Mostrando _START_ a _END_ de _TOTAL_',
                infoEmpty: 'Sin notificaciones',
                infoFiltered: '(filtrado de _MAX_)',
                search: 'Buscar:',
                lengthMenu: 'Mostrar _MENU_',
                paginate: { first: 'Primera', last: 'Ultima', next: 'Sig >', previous: '< Ant' }
            },
            createdRow: function (row, data) {
                $(row).addClass('sev-' + data.severidad);
            }
        });

        // Expandir/colapsar detalle
        $('#dt1 tbody').on('click', 'td.details-control', function () {
            const tr = $(this).closest('tr');
            const row = dataTable.row(tr);
            if (row.child.isShown()) {
                row.child.hide();
                tr.removeClass('shown');
            } else {
                row.child(renderDetail(row.data())).show();
                tr.addClass('shown');
            }
        });
    }

    // Extrae los PARAMETROS "de negocio" de la notificacion (sin las claves de
    // control del sobre) para mostrarlos como tabla clave/valor.
    function extractParams(datos) {
        if (datos === null || datos === undefined) return null;
        if (typeof datos !== 'object' || Array.isArray(datos)) return { valor: datos };

        // Sobre { v, grupo, id, severidad, mensaje, datos }: los parametros reales
        // viven en .datos.
        if (datos.datos !== undefined && datos.datos !== null) {
            const inner = datos.datos;
            if (typeof inner === 'object' && !Array.isArray(inner)) return inner;
            return { datos: inner };
        }

        // Payload plano: descartar las claves reservadas de control.
        const reserved = { v: 1, grupo: 1, id: 1, severidad: 1, _sev: 1, severity: 1,
                           mensaje: 1, _msg: 1, message: 1, coalesced: 1, items: 1 };
        const out = {};
        Object.keys(datos).forEach(function (k) {
            if (!reserved[k.toLowerCase()]) out[k] = datos[k];
        });
        return Object.keys(out).length ? out : null;
    }

    function renderParamsTable(params) {
        if (!params) return '<div class="notif-noparams">Sin parametros</div>';
        let html = '<table class="notif-params"><tbody>';
        Object.keys(params).forEach(function (k) {
            let v = params[k];
            if (v !== null && typeof v === 'object') v = safeJson(v);
            html += '<tr><th>' + escapeHtml(k) + '</th><td>' + escapeHtml(v) + '</td></tr>';
        });
        html += '</tbody></table>';
        return html;
    }

    function renderDetail(data) {
        const notifId = pick(data.datos, ['id', '_id']) || '-';
        const meta = 'grupo: ' + escapeHtml(data.grupo) +
            '  |  origen: ' + escapeHtml(data.origen) +
            '  |  severidad: ' + escapeHtml(data.severidad) +
            '  |  id: ' + escapeHtml(notifId) +
            '  |  hora: ' + escapeHtml(data.hora);

        const params = extractParams(data.datos);

        return '<div class="notif-detail">' +
            '<div class="notif-section-title">Parametros</div>' +
            renderParamsTable(params) +
            '<div class="notif-section-title">Payload completo</div>' +
            '<pre class="notif-json"><span class="meta">' + meta + '</span>\n\n' +
            escapeHtml(safeJson(data.datos)) + '</pre>' +
            '</div>';
    }

    // ======================================================================
    // Insercion de filas
    // ======================================================================
    function addRows(rows) {
        if (!rows || !rows.length) return;

        rows.forEach(function (r) {
            stats.total += 1;
            if (r.severidad === 'error') stats.error += 1;
            else if (r.severidad === 'warning') stats.warning += 1;
            else stats.info += 1;
            if (r.tipo === 'Proceso') stats.procesos += 1;
            registerTipo(r.tipo);
        });

        if (paused) { updateStats(); return; }

        rows.forEach(function (r) {
            const node = dataTable.row.add(r).node();
            $(node).addClass('row-new');
            setTimeout(function () { $(node).removeClass('row-new'); }, 1500);
        });

        // Trim del buffer (elimina las mas viejas por ts)
        trimBuffer();

        dataTable.order([1, 'desc']).draw(false);
        updateStats();

        if ($('#chk-autoscroll').is(':checked')) {
            // Ir a la primera pagina donde estan las mas recientes.
            dataTable.page('first').draw(false);
        }
    }

    function trimBuffer() {
        const count = dataTable.rows().count();
        if (count <= MAX_ROWS) return;
        const overflow = count - MAX_ROWS;
        const all = dataTable.rows().data().toArray();
        all.sort(function (a, b) { return a.ts - b.ts; });          // mas viejas primero
        const idsToRemove = all.slice(0, overflow).map(function (r) { return r.id; });
        idsToRemove.forEach(function (id) {
            dataTable.row('#' + id).remove();
        });
    }

    function updateStats() {
        $('#stat-total').text(stats.total);
        $('#stat-info').text(stats.info);
        $('#stat-warning').text(stats.warning);
        $('#stat-error').text(stats.error);
        $('#stat-procesos').text(stats.procesos);
    }

    function registerTipo(tipo) {
        if (knownTipos[tipo]) return;
        knownTipos[tipo] = true;
        $('#filter-tipo').append(
            $('<option>').attr('value', tipo).text(tipo)
        );
    }

    // ======================================================================
    // Filtros (custom search sobre columnas tipo/severidad)
    // ======================================================================
    function setupFilters() {
        $.fn.dataTable.ext.search.push(function (settings, rowData, rowIdx, data) {
            const tipoF = $('#filter-tipo').val();
            const sevF = $('#filter-severidad').val();
            if (tipoF && data.tipo !== tipoF) return false;
            if (sevF && data.severidad !== sevF) return false;
            return true;
        });

        $('#filter-tipo, #filter-severidad').on('change', function () {
            dataTable.draw(false);
        });
    }

    // ======================================================================
    // Controles
    // ======================================================================
    function setupControls() {
        $('#btn-pause').on('click', function () {
            paused = !paused;
            $('body').toggleClass('monitor-paused', paused);
            $(this).html(paused
                ? '<i class="fas fa-play"></i> Reanudar'
                : '<i class="fas fa-pause"></i> Pausar');
            $(this).toggleClass('btn-outline-secondary', !paused)
                   .toggleClass('btn-warning', paused);
        });

        $('#btn-clear').on('click', function () {
            dataTable.clear().draw();
            stats.total = stats.info = stats.warning = stats.error = stats.procesos = 0;
            updateStats();
        });
    }

    // ======================================================================
    // SignalR
    // ======================================================================
    function setupWebSocket() {
        hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(HUB_URL, { withCredentials: true })
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: function (ctx) {
                    if (ctx.previousRetryCount >= MAX_RECONNECT_ATTEMPTS) return null;
                    return Math.min(RECONNECT_DELAY_MS * Math.pow(1.5, ctx.previousRetryCount), 30000);
                }
            })
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        hubConnection.on('ReceiveMessage', function (messageCode, payload) {
            try {
                addRows(toRows(messageCode, payload));
            } catch (e) {
                console.error('Error procesando notificacion', messageCode, e);
            }
        });

        hubConnection.onreconnecting(function () { setStatus('reconnecting'); });
        hubConnection.onreconnected(function () { setStatus('connected'); subscribeAll(); });
        hubConnection.onclose(function () {
            setStatus('disconnected');
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts += 1;
                setTimeout(startConnection, RECONNECT_DELAY_MS * reconnectAttempts);
            }
        });

        startConnection();
    }

    function startConnection() {
        hubConnection.start()
            .then(function () {
                reconnectAttempts = 0;
                setStatus('connected');
                subscribeAll();
            })
            .catch(function (err) {
                console.error('Error conectando al Hub:', err);
                setStatus('error');
                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts += 1;
                    setTimeout(startConnection, RECONNECT_DELAY_MS * reconnectAttempts);
                }
            });
    }

    // El grupo user:{codigo} se auto-une en OnConnectedAsync (menciones + ops
    // donde participo). Aca sumamos: (1) el firehose de notificaciones PPL, y
    // (2) los grupos de CHAT (canal publico + canales visibles) para capturar
    // TODA la mensajeria, no solo la dirigida al usuario.
    function subscribeAll() {
        hubConnection.invoke('Subscribe', FIREHOSE_GROUP)
            .then(function () { console.log('Suscrito al firehose', FIREHOSE_GROUP); })
            .catch(function (err) { console.error('Error suscribiendo al firehose:', err); });

        // Canal publico: todo usuario autenticado esta autorizado. Directo (no
        // depende del backend PPL) para garantizar la captura del chat general.
        hubConnection.invoke('Subscribe', 'channel:global')
            .catch(function (err) { console.error('Error suscribiendo a channel:global:', err); });

        subscribeChatChannels();
    }

    // Suscribe a los canales de chat que el usuario puede ver. La lista de
    // channel:{id} candidatos la da el backend (GetGruposChat); PPLHub autoriza
    // cada uno por perfil (los restringidos se saltean). Best-effort: si el
    // backend no responde, ya quedamos suscritos a channel:global + user:{code}.
    function subscribeChatChannels() {
        if (typeof bound === 'undefined' || !bound.execPPL) return;
        bound.execPPL('GetGruposChat()').then(function (result) {
            const grupos = rowsFromResult(result)
                .map(function (r) { return r.grupo; })
                .filter(Boolean);
            if (grupos.length) {
                hubConnection.invoke('SubscribeMany', grupos)
                    .catch(function (err) { console.error('Error suscribiendo a canales de chat:', err); });
            }
        }).catch(function (err) {
            console.warn('No se pudieron obtener los grupos de chat:', err);
        });
    }

    function setStatus(status) {
        let html, cls;
        switch (status) {
            case 'connected':
                html = '<i class="fas fa-circle text-success"></i> En vivo'; cls = 'text-success'; break;
            case 'reconnecting':
                html = '<i class="fas fa-circle text-warning"></i> Reconectando…'; cls = 'text-warning'; break;
            case 'disconnected':
            case 'error':
                html = '<i class="fas fa-circle text-danger"></i> Desconectado'; cls = 'text-danger'; break;
            default:
                html = '<i class="fas fa-circle text-muted"></i> Conectando…'; cls = 'text-muted';
        }
        $('#ws-status').html(html).removeClass().addClass(cls);
    }

    // ======================================================================
    // Header opcional: hora del servidor
    // ======================================================================
    function loadServerInfo() {
        if (typeof bound === 'undefined' || !bound.execPPL) return;
        bound.execPPL('GetServerInfo()').then(function () {
            // Informativo; el header en vivo lo maneja el estado del socket.
        }).catch(function () { /* silencioso: el monitor no depende del backend */ });
    }

    // ======================================================================
    // Init
    // ======================================================================
    function init() {
        initDataTable();
        setupFilters();
        setupControls();
        setupWebSocket();
        loadServerInfo();
    }

    window.addEventListener('beforeunload', function () {
        if (hubConnection) hubConnection.stop();
    });

    $(document).ready(function () {
        $(document).on('click', 'a[href="#"], a[href=""]', function (e) { e.preventDefault(); });
        init();
    });

})();
