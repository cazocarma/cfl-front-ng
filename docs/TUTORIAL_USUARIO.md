# Tutorial CFL — Control de Fletes Greenvic

Guía paso a paso para operadores del sistema. Cubre flujo operacional (ingresar y procesar fletes) y tareas administrativas (mantenedores, auditoría, usuarios/permisos).

---

## 1. Introducción

CFL (Control de Fletes) es el sistema que Greenvic usa para gestionar el transporte de fruta desde los predios productores hasta los centros de proceso. Recibe datos de despacho desde **SAP** y de recepción desde la **Romana** (balanza), consolida los movimientos en un **flete**, y los entrega facturados a través de **planillas SAP** a contabilidad.

### Flujo general

```
  SAP (despachos)                   Romana (recepciones)
        │                                     │
        └────────► Bandeja de Fletes ◄────────┘
                       │
                       ▼
          Pre factura (revisión interna)
                       │
                       ▼
          Planilla SAP (envío a contabilidad)
```

### Roles del sistema

| Rol | Qué puede hacer |
|---|---|
| **Administrador** | Acceso total, incluye Auditoría y todos los mantenedores |
| **Autorizador** | Operaciones + la mayoría de mantenedores, autoriza cambios |
| **Ingresador** | Carga y edita fletes, ve facturas y planillas en modo lectura |

Si un botón aparece deshabilitado o un menú no se ve, lo más probable es que tu rol no tenga ese permiso. Revisa con el Administrador.

---

## 2. Ingreso al sistema

1. Abre el navegador en la URL del sistema (en PRD, `http://<ip-servidor>`).
2. Pantalla de **Login**: ingresa tu **usuario** y **contraseña**.
3. Al entrar serás redirigido a la **Bandeja de Fletes**.

**Cerrar sesión:** menú superior derecho (tu nombre) → **Cerrar sesión**. La sesión también expira automáticamente después de 8 horas.

**Sidebar izquierda** (navegación principal): los ítems que ves dependen de tu rol.

---

## 3. Bandeja de Fletes

Pantalla central del sistema. Aquí se gestionan todos los fletes.

### Pestañas

- **Candidatos:** fletes que llegaron desde SAP/Romana pero aún no han sido procesados. Requieren revisión.
- **En Curso:** fletes ya ingresados o completados, en distintos estados.

### Estados de un flete

| Estado | Significado |
|---|---|
| **Detectado** | Recién leído desde SAP/Romana. Pendiente de completar datos |
| **Actualizado** | SAP reportó cambios en un flete existente. Requiere revisión |
| **En Revisión** | Faltan datos obligatorios (ruta, tarifa, transportista, etc.) |
| **Completado** | Listo para pre factura |
| **Pre Facturado** | Incluido en una pre factura borrador |
| **Facturado** | Pre factura pasó a planilla enviada |
| **Anulado** | Descartado permanentemente |

### 3.1 Completar un flete

1. En **Candidatos**, haz clic sobre la fila del flete.
2. Se abre un modal con los campos que llegaron desde SAP/Romana (patente, guía, fecha, productor, etc.) y los que debes completar:
   - **Tipo de flete** (ida, retorno, etc.)
   - **Ruta** (origen → destino)
   - **Tarifa** (se auto-sugiere según ruta + tipo + empresa)
   - **Empresa de transporte** y **chofer**
   - **Imputación** (tipo de flete + centro de costo + cuenta mayor)
   - **Monto extra** (opcional — peajes, adicionales)
   - Observaciones
3. Guarda. Si todos los campos obligatorios están completos, el flete pasa a **Completado**.

### 3.2 Descartar un candidato

Si un candidato no corresponde a un flete real (duplicado, error SAP), haz clic en **Descartar**, indica el **motivo**, y confirma. El flete sale de la bandeja sin ingresarse al sistema.

### 3.3 Anular un flete ya ingresado

En la pestaña **En Curso**, abre el flete → botón **Anular** → ingresa motivo. Solo se puede anular si aún no está facturado.

### 3.4 Vaciar bandeja

Botón superior **Vaciar bandeja**: descarta masivamente todos los candidatos pendientes. **Úsalo con cuidado** — es reversible solo manualmente.

---

## 4. Carga de Entregas (ETL SAP + Romana)

Esta pantalla sincroniza datos desde los sistemas externos hacia CFL. La usas cuando necesitas traer un despacho específico o recuperar un rango de fechas.

### 4.1 Cargar despachos SAP

**Por VBELN (número de entrega puntual):**
1. Pestaña **SAP → Por VBELN**.
2. Pega uno o varios números de entrega separados por coma.
3. **Ejecutar**. El sistema lanza un job asíncrono.

**Por rango de fechas:**
1. Pestaña **SAP → Por rango**.
2. Selecciona fecha desde/hasta (máximo configurado en `CFL_ETL_MAX_DATE_RANGE_DAYS`, por defecto ~15 días).
3. **Ejecutar**.

### 4.2 Cargar recepciones Romana

Pestaña **Romana → Por rango**. Mismo flujo que SAP pero trae datos de balanza.

### 4.3 Monitor de jobs

Tabla inferior con historial. Estados posibles:

| Estado | Qué significa |
|---|---|
| **Pendiente / En Cola** | Esperando que el backend procese |
| **En Ejecución** | Cargando datos en este momento |
| **Completado** | Todo OK |
| **Parcial** | Terminó con observaciones (algunos registros fallaron) |
| **Fallido** | Error — revisa el detalle |

Haz clic en una fila para ver el detalle por registro (qué entrega, qué error, cuántos insertados vs actualizados).

**Error común:** "No hay datos para el rango" → habitualmente el rango elegido está fuera de lo que SAP/Romana tienen disponible.

---

## 5. Pre Facturas

Documento interno que agrupa fletes completados de un mismo transportista para revisión antes de facturar a contabilidad.

### 5.1 Crear una pre factura

1. Menú **Pre Facturas** → botón **+ Nueva pre factura**.
2. **Paso 1:** selecciona la **empresa de transporte**.
3. **Paso 2:** el sistema lista todos los fletes en estado **Completado** de esa empresa. Marca los que incluirás.
4. **Paso 3:** revisa el total, agrega observaciones.
5. **Generar**. La pre factura queda en estado **Borrador**.

### 5.2 Estados

| Estado | Qué puedes hacer |
|---|---|
| **Borrador** | Editar líneas, anular, descargar Excel |
| **Recibida** | Ya no se edita. Esperando a ser incluida en planilla SAP |
| **Anulada** | Cancelada permanentemente |

### 5.3 Editar borrador

Abre la pre factura → **Editar**. Puedes ajustar montos por línea, agregar movimientos adicionales, y luego **Guardar**.

### 5.4 Exportar

**Descargar Excel** o **PDF** desde el botón superior derecho del detalle.

### 5.5 Anular

Solo funciona en estado **Borrador**. Una vez que cambia a **Recibida**, ya no se puede.

---

## 6. Planillas SAP

Consolidan pre facturas recibidas en un único documento que se envía a contabilidad SAP.

### 6.1 Generar una planilla

1. Menú **Planillas SAP** → botón **+ Generar planilla**.
2. El sistema lista todas las pre facturas en estado **Recibida** que aún no están en planilla.
3. Marca las que incluirás.
4. Completa **período**, **glosa** y **fecha de emisión**.
5. **Generar**. La planilla queda en estado **Generada**.

### 6.2 Estados

| Estado | Qué puedes hacer |
|---|---|
| **Generada** | Editar encabezado/líneas, descargar Excel, enviar |
| **Enviada** | Solo lectura |
| **Anulada** | Cancelada |

### 6.3 Descargar para SAP

Botón **Descargar Excel** → usa ese archivo para cargar en SAP. Luego marca la planilla como **Enviada**.

---

## 7. Estadísticas

Dashboard ejecutivo — solo lectura, no hace acciones.

### KPIs principales (tarjetas superiores)
- Total de fletes del período
- Monto total
- Pre facturas generadas
- Fletes por estado (completados, en revisión, anulados)

### Gráficos
- **Tendencia mensual** de volumen
- **Despacho vs retorno** (tipos de flete)
- **Top transportistas** por monto
- **Distribución por centro de costo**
- **Distribución por productor**

### Filtros
Selector superior: **temporada** y **rango de fechas**. Los gráficos se recalculan al cambiar filtros.

---

## 8. Mantenedores

CRUD de las tablas maestras del sistema. La lista que ves depende de tu rol.

### Entidades disponibles

| Entidad | Para qué sirve |
|---|---|
| Temporadas | Períodos de operación (ej: 2025-2026) |
| Centros de costo | Códigos SAP de centros |
| Cuentas mayor | Cuentas contables |
| Tipos de flete | Ida, retorno, etc. |
| Tipos de camión | Configuraciones de vehículo |
| Camiones | Patentes y sus características |
| Empresas de transporte | Transportistas |
| Choferes | Conductores |
| Productores | Predios de origen |
| Nodos logísticos | Ubicaciones de origen/destino |
| Rutas | Pares origen-destino |
| Tarifas | Precio por ruta/tipo/empresa |
| Especies | Tipo de fruta |
| Detalles de viaje | Observaciones estándar |
| Imputaciones de flete | Combo tipo flete + centro + cuenta |
| Usuarios | Cuentas del sistema |
| Roles | Roles del sistema |
| Permisos | Catálogo de permisos |

### Flujo típico

1. Menú **Mantenedores** → selecciona la entidad en el menú lateral.
2. **Buscar** por nombre/código con el filtro superior.
3. **+ Nuevo** para crear, o clic en fila para **editar**.
4. **Guardar**. Los cambios quedan activos de inmediato.

### Desactivar vs eliminar

La mayoría de entidades tiene un campo **Activo**. En lugar de borrar, **desmarca Activo** para que el registro no aparezca en listas nuevas pero se preserve la historia.

### 8.1 Gestión de usuarios (Administrador)

1. Mantenedores → **Usuarios** → **+ Nuevo**.
2. Completa: username, email, nombre, apellido, password temporal.
3. Marca **Activo**.
4. **Guardar**.
5. Luego edita el usuario y asigna **Roles** (sección inferior del formulario). Puede tener más de un rol.

### 8.2 Gestión de permisos por rol (Administrador)

1. Mantenedores → **Roles** → clic en el rol.
2. Sección **Permisos**: marca/desmarca los permisos que incluye el rol.
3. **Guardar**. Los cambios se aplican la próxima vez que el usuario inicie sesión (o refresque).

> **Importante:** El rol **Administrador** tiene bypass automático — siempre pasa todos los chequeos, aunque no tenga el permiso marcado explícitamente. No lo toques a menos que sepas lo que estás haciendo.

---

## 9. Auditoría (solo Administrador)

Registro histórico de todas las acciones del sistema.

### Qué se audita

- Logins (exitosos y fallidos)
- Creación, edición y anulación de fletes
- Generación y edición de pre facturas y planillas
- Descartes de candidatos
- Cambios en mantenedores
- Ejecuciones ETL SAP/Romana

### Vista

- **Resumen:** total eventos, eventos hoy, usuarios activos en últimos 7 días.
- **Entidades más auditadas:** frecuencia por tipo.
- **Acciones frecuentes:** top acciones del período.
- **Actividad reciente:** tabla con usuario, acción, entidad, IP, timestamp. Clic en una fila para ver el detalle (antes/después en cambios de datos).

### Filtros
Por usuario, por rango de fechas, por tipo de acción, por entidad.

---

## 10. Glosario

| Término | Significado |
|---|---|
| **VBELN** | Número de entrega SAP (clave primaria de LIKP/LIPS) |
| **LIKP** | Cabecera de entrega en SAP (ship-to, fechas, partners) |
| **LIPS** | Posición/línea de entrega SAP (material, cantidad) |
| **Romana** | Sistema de balanza en el centro de proceso |
| **Partida** | Número interno de la romana |
| **Flete** | Movimiento completo origen-destino en CFL |
| **Pre factura** | Documento interno de facturación al transportista |
| **Planilla SAP** | Consolidado de pre facturas para contabilidad |
| **ETL** | Proceso de carga de datos (Extract-Transform-Load) |
| **Imputación** | Combo tipo-flete + centro-costo + cuenta-mayor |
| **Candidato** | Flete detectado por SAP/Romana pendiente de completar |
| **Nodo logístico** | Punto geográfico (predio, planta, puerto) |

---

## 11. FAQ / errores comunes

**"No veo el menú de Auditoría / Mantenedores"**
Tu rol no incluye ese acceso. Auditoría es solo para Administrador; Mantenedores requiere el permiso `mantenedores.view`.

**"El botón Generar Planilla está gris"**
Necesitas el permiso `planillas.generar` y al menos una pre factura en estado **Recibida**.

**"Un flete candidato no se puede completar: falta tarifa"**
Probablemente no hay tarifa definida para esa ruta + tipo + empresa. Pídele al Autorizador que agregue la tarifa en **Mantenedores → Tarifas**.

**"Un job ETL quedó en Fallido"**
Haz clic en el job y lee el mensaje de error:
- *"Connection timeout"* → el servicio SAP ETL está caído, reintenta en unos minutos.
- *"No hay datos"* → el rango está vacío, amplíalo.
- *"Validación fallida en registro X"* → hay un dato corrupto; reporta al equipo técnico.

**"Ya cargué el despacho pero no aparece en Bandeja"**
Revisa en **Carga de Entregas → Monitor** que el job haya terminado **Completado**. Si quedó Parcial, alguna entrega puede estar descartada; revisa el detalle.

**"Cambié los permisos de un rol y el usuario sigue sin verlos"**
El usuario debe **cerrar sesión** y volver a entrar. Los permisos se cachean por sesión.

**"La sesión expiró mientras trabajaba"**
Se cierra automáticamente a las 8 horas. Vuelve a loguearte; los datos guardados no se pierden.

---

## Soporte

Para incidencias operacionales habla primero con tu Administrador CFL. Para errores del sistema o pedidos de feature, escala al equipo técnico de Greenvic.
