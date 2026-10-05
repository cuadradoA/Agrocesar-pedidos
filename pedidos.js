/**
 * MFE Seguimiento de Pedidos (AgroCesar)
 * Tecnología: Vue 3 (vía CDN)
 * Responsable: Anderson Javier Cuadrado Arguello
 */

(function () {
  // Guardar instancias activas para soporte multicontenedor o limpieza previa
  const activeApps = new Map();
  const activeTimers = new Map();
  const activeListeners = new Map();

  const ESTADOS = ['Recibido', 'En preparación', 'En camino', 'Entregado'];

  /**
   * Montaje del MFE en el contenedor especificado
   */
  window.mountAgroSeguimiento = function (containerId, props = {}) {
    const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) {
      console.error(`[AgroSeguimiento] Contenedor '${containerId}' no encontrado.`);
      return;
    }

    // Desmontar si ya existe una instancia previa en este contenedor
    if (window.unmountAgroSeguimiento) {
      window.unmountAgroSeguimiento(containerId);
    }

    // Asegurar estructura del DOM para Vue
    container.innerHTML = '<div id="agro-pedidos-app"></div>';
    const mountTarget = container.querySelector('#agro-pedidos-app');

    const { createApp, ref, computed, onMounted, onUnmounted } = window.Vue;

    const app = createApp({
      template: `
        <div class="agro-pedidos-container">
          <div class="agro-pedidos-header">
            <h3>📦 Seguimiento de Pedido</h3>
            <span class="agro-pedidos-badge">{{ pedidoId ? 'Pedido #' + pedidoId : 'Esperando pedido...' }}</span>
          </div>

          <div v-if="!pedidoId" class="agro-simulador-panel" style="text-align: center;">
            <p>No hay pedidos en curso. Activamos la escucha de eventos...</p>
            <button class="agro-btn" @click="simularPedidoSimulado">Simular Pedido de Prueba (v2)</button>
          </div>

          <div v-else>
            <div style="margin-bottom: 12px; font-size: 0.95rem;">
              <strong>Total:</strong> \${{ totalFormat }} COP
              <span v-if="conductorId" style="color: #6b7280; margin-left: 8px;">(Conductor: {{ conductorId }})</span>
            </div>

            <div class="agro-estado-timeline">
              <div 
                v-for="(estado, index) in estados" 
                :key="estado"
                class="agro-timeline-step"
                :class="{
                  'completed': index < estadoActualIndex,
                  'active': index === estadoActualIndex
                }"
              >
                <div class="agro-step-dot">{{ index + 1 }}</div>
                <div class="agro-step-label">{{ estado }}</div>
              </div>
            </div>

            <div class="agro-simulador-panel">
              <strong>Estado Actual:</strong> {{ estadoActual }}
              <div style="font-size: 0.8rem; color: #6b7280; margin-top: 4px;">
                Simulación de avances logísticos automática activa.
              </div>
            </div>
          </div>
        </div>
      `,
      setup() {
        const pedidoId = ref(props.pedidoId || null);
        const total = ref(props.total || 0);
        const conductorId = ref(props.conductorId || null);
        const estadoActualIndex = ref(0);

        const estadoActual = computed(() => ESTADOS[estadoActualIndex.value]);
        const totalFormat = computed(() => total.value.toLocaleString());

        let timerId = null;

        const notificarEstado = () => {
          if (!pedidoId.value) return;
          const eventoEstado = new CustomEvent('pedido:estado', {
            detail: {
              pedidoId: pedidoId.value,
              estado: estadoActual.value
            },
            bubbles: true
          });
          window.dispatchEvent(eventoEstado);
          console.log(`[AgroSeguimiento] Emitido pedido:estado ->`, eventoEstado.detail);
        };

        const iniciarSimulacionLogistica = () => {
          if (timerId) clearInterval(timerId);
          estadoActualIndex.value = 0;
          notificarEstado();

          timerId = setInterval(() => {
            if (estadoActualIndex.value < ESTADOS.length - 1) {
              estadoActualIndex.value++;
              notificarEstado();
            } else {
              clearInterval(timerId);
              timerId = null;
              activeTimers.delete(containerId);
            }
          }, 4000);

          activeTimers.set(containerId, timerId);
        };

        // Manejo de eventos pedido:confirmado y pedido:confirmado:v2 (retrocompatible)
        const handlePedidoConfirmado = (event) => {
          const detail = event.detail || {};
          console.log('[AgroSeguimiento] Evento pedido:confirmado recibido:', detail);

          // Soporte v1 y v2: extrae pedidoId y total obligatorios, idConductor si viene en v2
          pedidoId.value = detail.pedidoId || detail.id || 'PED-' + Math.floor(Math.random() * 1000);
          total.value = detail.total || 0;
          conductorId.value = detail.idConductor || detail.conductorId || null;

          iniciarSimulacionLogistica();
        };

        const simularPedidoSimulado = () => {
          const eventoV2 = new CustomEvent('pedido:confirmado:v2', {
            detail: {
              pedidoId: 'PED-' + Math.floor(Math.random() * 8999 + 1000),
              total: 45000,
              idConductor: 'COND-99 (Juan Pérez)'
            }
          });
          window.dispatchEvent(eventoV2);
        };

        onMounted(() => {
          // Suscripción a v1 y v2
          window.addEventListener('pedido:confirmado', handlePedidoConfirmado);
          window.addEventListener('pedido:confirmado:v2', handlePedidoConfirmado);

          activeListeners.set(containerId, handlePedidoConfirmado);

          if (pedidoId.value) {
            iniciarSimulacionLogistica();
          }
        });

        onUnmounted(() => {
          if (timerId) {
            clearInterval(timerId);
            console.log('[AgroSeguimiento] Intervalo de logística limpiado.');
          }
          window.removeEventListener('pedido:confirmado', handlePedidoConfirmado);
          window.removeEventListener('pedido:confirmado:v2', handlePedidoConfirmado);
        });

        return {
          pedidoId,
          total,
          conductorId,
          estados: ESTADOS,
          estadoActualIndex,
          estadoActual,
          totalFormat,
          simularPedidoSimulado
        };
      }
    });

    const vm = app.mount(mountTarget);
    activeApps.set(containerId, app);

    console.log(`[AgroSeguimiento] Montado con éxito en #${containerId}`);
  };

  /**
   * Desmontaje del MFE garantizando no dejar timers ni listeners huérfanos
   */
  window.unmountAgroSeguimiento = function (containerId) {
    const targetId = typeof containerId === 'string' ? containerId : containerId.id;

    // Limpiar temporizador activo si existe
    if (activeTimers.has(targetId)) {
      clearInterval(activeTimers.get(targetId));
      activeTimers.delete(targetId);
      console.log(`[AgroSeguimiento] Timer de '${targetId}' detenido.`);
    }

    // Remover listeners
    if (activeListeners.has(targetId)) {
      const listener = activeListeners.get(targetId);
      window.removeEventListener('pedido:confirmado', listener);
      window.removeEventListener('pedido:confirmado:v2', listener);
      activeListeners.delete(targetId);
    }

    // Desmontar app Vue
    if (activeApps.has(targetId)) {
      const app = activeApps.get(targetId);
      app.unmount();
      activeApps.delete(targetId);
      console.log(`[AgroSeguimiento] Instancia de Vue desmontada de '${targetId}'.`);
    }

    const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (container) {
      container.innerHTML = '';
    }
  };
})();
