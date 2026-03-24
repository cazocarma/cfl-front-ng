// ─── Tipos de campo en formulario ───────────────────────────────────────────
export type CampoTipo =
  | 'text'
  | 'email'
  | 'number'
  | 'date'
  | 'boolean'
  | 'textarea'
  | 'select-static'   // opciones fijas
  | 'select-entity'   // carga dinámica desde API
  | 'password';

export interface OpcionSelect {
  value: string | number;
  label: string;
}

// ─── Definición de campo de formulario ──────────────────────────────────────
export interface CampoDef {
  key: string;
  label: string;
  tipo: CampoTipo;
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  opciones?: OpcionSelect[];        // para select-static
  entity?: string;                  // para select-entity (key del backend)
  labelFields?: string[];           // campos a concatenar para mostrar
  valueField?: string;              // campo ID de la opción (default: id_*)
  nullLabel?: string;               // etiqueta para opción vacía
}

// ─── Definición de columna en tabla ─────────────────────────────────────────
export type ColumnaTipo = 'text' | 'bool' | 'date' | 'badge' | 'currency' | 'mono' | 'number';

export interface ColumnaDef {
  key: string;
  label: string;
  tipo?: ColumnaTipo;
  badgeMap?: Record<string, string>; // valor → clase CSS badge
}

// ─── Config de un mantenedor ─────────────────────────────────────────────────
export type TipoEspecial = 'usuarios' | 'tarifas' | 'rutas';

export interface MantenedorConfig {
  key: string;              // coincide con el entityKey del backend
  title: string;
  icon: string;             // SVG path data
  description: string;
  idField: string;
  columnas: ColumnaDef[];
  camposCrear: CampoDef[];
  camposEditar?: CampoDef[]; // si no se define, usa camposCrear
  softDeleteField?: string;  // campo para activar/desactivar (activo | activa)
  permiso: string;           // clave base de permiso (sin prefijo mantenedores.view.)
  tipoEspecial?: TipoEspecial;
}

// ─── Configuración de todas las entidades ────────────────────────────────────
export const MANTENEDORES_CONFIG: MantenedorConfig[] = [
  // ── Empresas de Transporte ──────────────────────────────────────────────
  {
    key: 'empresas-transporte',
    title: 'Empresas de Transporte',
    icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
    description: 'Transportistas y proveedores de servicio de flete.',
    idField: 'id_empresa',
    softDeleteField: 'activo',
    permiso: 'empresas-transporte',
    columnas: [
      { key: 'rut',         label: 'RUT',          tipo: 'mono' },
      { key: 'razon_social',label: 'Razón Social',  tipo: 'text' },
      { key: 'correo',      label: 'Correo',        tipo: 'text' },
      { key: 'telefono',    label: 'Teléfono',      tipo: 'text' },
      { key: 'activo',      label: 'Activo',        tipo: 'bool' },
    ],
    camposCrear: [
      { key: 'rut',         label: 'RUT',             tipo: 'text',  required: true, placeholder: 'Ej: 12.345.678-9' },
      { key: 'sap_codigo',  label: 'Cód. SAP',        tipo: 'text',  placeholder: 'Código SAP' },
      { key: 'razon_social',label: 'Razón Social',    tipo: 'text',  placeholder: 'Nombre empresa' },
      { key: 'nombre_rep',  label: 'Representante',   tipo: 'text',  placeholder: 'Nombre del representante' },
      { key: 'correo',      label: 'Correo',          tipo: 'email', placeholder: 'contacto@empresa.cl' },
      { key: 'telefono',    label: 'Teléfono',        tipo: 'text',  placeholder: '+56 9 1234 5678' },
    ],
  },

  // ── Choferes ────────────────────────────────────────────────────────────
  {
    key: 'productores',
    title: 'Productores',
    icon: 'M17 20h5V4H2v16h5m10 0v-8a2 2 0 00-2-2H9a2 2 0 00-2 2v8m10 0H7m8-12h.01M12 8h.01M9 8h.01M15 12h.01M12 12h.01M9 12h.01',
    description: 'Productores y proveedores SAP asociados a la operacion de fletes.',
    idField: 'IdProductor',
    softDeleteField: 'Activo',
    permiso: 'productores',
    columnas: [
      { key: 'CodigoProveedor',    label: 'Codigo',      tipo: 'mono' },
      { key: 'Rut',                label: 'RUT',         tipo: 'mono' },
      { key: 'Nombre',             label: 'Nombre',      tipo: 'text' },
      { key: 'Comuna',             label: 'Comuna',      tipo: 'text' },
      { key: 'OrganizacionCompra', label: 'Org. Compra', tipo: 'text' },
      { key: 'Email',              label: 'Email',       tipo: 'text' },
      { key: 'Activo',             label: 'Activo',      tipo: 'bool' },
    ],
    camposCrear: [
      { key: 'CodigoProveedor',    label: 'Codigo Proveedor',    tipo: 'text',   required: true, placeholder: 'Ej: 10002086' },
      { key: 'Rut',                label: 'RUT',                 tipo: 'text',   placeholder: 'Ej: 76320743-9' },
      { key: 'Nombre',             label: 'Nombre',              tipo: 'text',   required: true, placeholder: 'Razon social o nombre' },
      { key: 'Pais',               label: 'Pais',                tipo: 'text',   placeholder: 'Ej: CL' },
      { key: 'Region',             label: 'Region',              tipo: 'text',   placeholder: 'Ej: 13' },
      { key: 'Comuna',             label: 'Comuna',              tipo: 'text',   placeholder: 'Ej: Vitacura' },
      { key: 'Distrito',           label: 'Distrito',            tipo: 'text',   placeholder: 'Distrito' },
      { key: 'Calle',              label: 'Calle',               tipo: 'text',   placeholder: 'Direccion' },
      { key: 'Email',              label: 'Email',               tipo: 'email',  placeholder: 'correo@productor.cl' },
      { key: 'OrganizacionCompra', label: 'Organizacion Compra', tipo: 'text',   placeholder: 'Ej: 1000' },
      { key: 'MonedaPedido',       label: 'Moneda Pedido',       tipo: 'text',   placeholder: 'Ej: CLP' },
      { key: 'CondicionPago',      label: 'Condicion Pago',      tipo: 'text',   placeholder: 'Ej: C030' },
      { key: 'Incoterm',           label: 'Incoterm',            tipo: 'text',   placeholder: 'Incoterm' },
      { key: 'Sociedad',           label: 'Sociedad',            tipo: 'text',   placeholder: 'Ej: 1000' },
      { key: 'CuentaAsociada',     label: 'Cuenta Asociada',     tipo: 'text',   placeholder: 'Cuenta contable' },
      { key: 'Activo',             label: 'Activo',              tipo: 'boolean' },
    ],
  },

  {
    key: 'choferes',
    title: 'Choferes',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    description: 'Conductores registrados en el sistema.',
    idField: 'id_chofer',
    softDeleteField: 'activo',
    permiso: 'choferes',
    columnas: [
      { key: 'sap_id_fiscal',label: 'ID Fiscal SAP', tipo: 'mono' },
      { key: 'sap_nombre',   label: 'Nombre',        tipo: 'text' },
      { key: 'telefono',     label: 'Teléfono',      tipo: 'text' },
      { key: 'activo',       label: 'Activo',        tipo: 'bool' },
    ],
    camposCrear: [
      { key: 'sap_id_fiscal',label: 'ID Fiscal SAP', tipo: 'text', required: true, placeholder: 'ID fiscal en SAP' },
      { key: 'sap_nombre',   label: 'Nombre',        tipo: 'text', required: true, placeholder: 'Nombre completo' },
      { key: 'telefono',     label: 'Teléfono',      tipo: 'text', placeholder: '+56 9 1234 5678' },
    ],
  },

  // ── Camiones ────────────────────────────────────────────────────────────
  {
    key: 'camiones',
    title: 'Camiones',
    icon: 'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0',
    description: 'Vehículos de carga registrados en el sistema.',
    idField: 'id_camion',
    softDeleteField: 'activo',
    permiso: 'camiones',
    columnas: [
      { key: 'sap_patente',      label: 'Patente',      tipo: 'mono' },
      { key: 'sap_carro',        label: 'Carro SAP',    tipo: 'mono' },
      { key: 'tipo_camion_nombre',label: 'Tipo',        tipo: 'text' },
      { key: 'activo',           label: 'Activo',       tipo: 'bool' },
    ],
    camposCrear: [
      { key: 'id_tipo_camion', label: 'Tipo de Camión', tipo: 'select-entity', entity: 'tipos-camion', required: true,
        labelFields: ['nombre'], valueField: 'id_tipo_camion', nullLabel: 'Seleccionar tipo...' },
      { key: 'sap_patente',    label: 'Patente SAP',    tipo: 'text',  required: true, placeholder: 'Ej: ABC123' },
      { key: 'sap_carro',      label: 'N° Carro SAP',   tipo: 'text',  required: true, placeholder: 'Carro en SAP' },
    ],
  },

  // ── Tipos de Camión ──────────────────────────────────────────────────────
  {
    key: 'tipos-camion',
    title: 'Tipos de Camión',
    icon: 'M4 7a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7z',
    description: 'Categorías y capacidades de los vehículos.',
    idField: 'id_tipo_camion',
    softDeleteField: 'activo',
    permiso: 'tipos-camion',
    columnas: [
      { key: 'nombre',       label: 'Nombre',     tipo: 'text' },
      { key: 'categoria',    label: 'Categoría',  tipo: 'text' },
      { key: 'capacidad_kg', label: 'Capacidad (kg)', tipo: 'number' },
      { key: 'activo',       label: 'Activo',     tipo: 'bool' },
    ],
    camposCrear: [
      { key: 'nombre',               label: 'Nombre',            tipo: 'text',    required: true, placeholder: 'Ej: Camión 3/4' },
      { key: 'categoria',            label: 'Categoría',         tipo: 'text',    required: true, placeholder: 'Ej: LIVIANO' },
      { key: 'capacidad_kg',         label: 'Capacidad (kg)',     tipo: 'number',  required: true, min: 0 },
      { key: 'requiere_temperatura', label: 'Requiere temperatura', tipo: 'boolean' },
      { key: 'descripcion',          label: 'Descripción',       tipo: 'textarea', placeholder: 'Descripción opcional' },
    ],
  },

  // ── Rutas ────────────────────────────────────────────────────────────────
  {
    key: 'rutas',
    title: 'Rutas',
    icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
    description: 'Trayectos entre nodos logísticos.',
    idField: 'id_ruta',
    softDeleteField: 'activo',
    permiso: 'rutas',
    tipoEspecial: 'rutas',
    columnas: [
      { key: 'nombre_ruta',    label: 'Nombre Ruta', tipo: 'text' },
      { key: 'origen_nombre',  label: 'Origen',      tipo: 'text' },
      { key: 'destino_nombre', label: 'Destino',     tipo: 'text' },
      { key: 'distancia_km',   label: 'Dist. (km)',  tipo: 'number' },
      { key: 'activo',         label: 'Activo',      tipo: 'bool' },
    ],
    camposCrear: [
      { key: 'id_origen_nodo',  label: 'Nodo Origen',  tipo: 'select-entity', entity: 'nodos', required: true,
        labelFields: ['nombre'], valueField: 'id_nodo', nullLabel: 'Seleccionar origen...' },
      { key: 'id_destino_nodo', label: 'Nodo Destino', tipo: 'select-entity', entity: 'nodos', required: true,
        labelFields: ['nombre'], valueField: 'id_nodo', nullLabel: 'Seleccionar destino...' },
      { key: 'nombre_ruta',    label: 'Nombre de Ruta', tipo: 'text',   required: true, placeholder: 'Ej: Santiago → Concepción' },
      { key: 'distancia_km',   label: 'Distancia (km)', tipo: 'number', min: 0 },
    ],
  },

  // ── Tipos de Flete ───────────────────────────────────────────────────────
  {
    key: 'tipos-flete',
    title: 'Tipos de Flete',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    description: 'Clasificacion de los tipos de movimiento de flete.',
    idField: 'id_tipo_flete',
    softDeleteField: 'activo',
    permiso: 'tipos-flete',
    columnas: [
      { key: 'sap_codigo',                    label: 'Cod. SAP',       tipo: 'mono' },
      { key: 'nombre',                        label: 'Nombre',         tipo: 'text' },
      { key: 'cantidad_imputaciones_activas', label: 'Imput. activas', tipo: 'number' },
      { key: 'activo',                        label: 'Activo',         tipo: 'bool' },
    ],
    camposCrear: [
      { key: 'sap_codigo', label: 'Codigo SAP', tipo: 'text', required: true, placeholder: 'Cod. en SAP' },
      { key: 'nombre',     label: 'Nombre',     tipo: 'text', required: true, placeholder: 'Nombre del tipo' },
    ],
  },

  {
    key: 'imputaciones-flete',
    title: 'Imputaciones Flete',
    icon: 'M9 12h6m-6 4h6m-6-8h6m-9 9a2 2 0 01-2-2V7a2 2 0 012-2h11l4 4v10a2 2 0 01-2 2H7z',
    description: 'Reglas validas de imputacion por tipo, centro de costo y cuenta mayor.',
    idField: 'id_imputacion_flete',
    softDeleteField: 'activo',
    permiso: 'imputaciones-flete',
    columnas: [
      { key: 'tipo_flete_sap_codigo',   label: 'Tipo SAP',     tipo: 'mono' },
      { key: 'tipo_flete_nombre',       label: 'Tipo Flete',   tipo: 'text' },
      { key: 'centro_costo_sap_codigo', label: 'Centro Costo', tipo: 'mono' },
      { key: 'cuenta_mayor_codigo',     label: 'Cuenta Mayor', tipo: 'mono' },
      { key: 'activo',                  label: 'Activo',       tipo: 'bool' },
    ],
    camposCrear: [
      { key: 'id_tipo_flete', label: 'Tipo de Flete', tipo: 'select-entity', entity: 'tipos-flete', required: true,
        labelFields: ['sap_codigo', 'nombre'], valueField: 'id_tipo_flete', nullLabel: 'Seleccionar...' },
      { key: 'id_centro_costo', label: 'Centro de Costo', tipo: 'select-entity', entity: 'centros-costo', required: true,
        labelFields: ['sap_codigo', 'nombre'], valueField: 'id_centro_costo', nullLabel: 'Seleccionar...' },
      { key: 'id_cuenta_mayor', label: 'Cuenta Mayor', tipo: 'select-entity', entity: 'cuentas-mayor', required: true,
        labelFields: ['codigo', 'glosa'], valueField: 'id_cuenta_mayor', nullLabel: 'Seleccionar...' },
      { key: 'activo', label: 'Activo', tipo: 'boolean' },
    ],
  },

  // ── Detalle de Viaje ─────────────────────────────────────────────────────
  {
    key: 'detalles-viaje',
    title: 'Detalle de Viaje',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    description: 'Tipos de detalle para viajes de flete.',
    idField: 'id_detalle_viaje',
    softDeleteField: 'activo',
    permiso: 'detalles-viaje',
    columnas: [
      { key: 'descripcion', label: 'Descripción', tipo: 'text' },
      { key: 'observacion', label: 'Observación', tipo: 'text' },
      { key: 'activo',      label: 'Activo',      tipo: 'bool' },
    ],
    camposCrear: [
      { key: 'descripcion', label: 'Descripción', tipo: 'text',    required: true, placeholder: 'Descripción del detalle' },
      { key: 'observacion', label: 'Observación', tipo: 'textarea', placeholder: 'Notas adicionales' },
    ],
  },

  // ── Temporadas ───────────────────────────────────────────────────────────
  {
    key: 'temporadas',
    title: 'Temporadas',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    description: 'Períodos de operación con sus fechas de inicio y cierre.',
    idField: 'id_temporada',
    softDeleteField: 'activa',
    permiso: 'temporadas',
    columnas: [
      { key: 'codigo',      label: 'Código',      tipo: 'mono' },
      { key: 'nombre',      label: 'Nombre',      tipo: 'text' },
      { key: 'fecha_inicio',label: 'Inicio',      tipo: 'date' },
      { key: 'fecha_fin',   label: 'Fin',         tipo: 'date' },
      { key: 'activa',      label: 'Activa',      tipo: 'bool' },
      { key: 'cerrada',     label: 'Cerrada',     tipo: 'bool' },
    ],
    camposCrear: [
      { key: 'codigo',      label: 'Código',        tipo: 'text', required: true, placeholder: 'Ej: 2025-01' },
      { key: 'nombre',      label: 'Nombre',        tipo: 'text', required: true, placeholder: 'Ej: Temporada 2025' },
      { key: 'fecha_inicio',label: 'Fecha Inicio',  tipo: 'date', required: true },
      { key: 'fecha_fin',   label: 'Fecha Fin',     tipo: 'date', required: true },
      { key: 'activa',      label: 'Activa',        tipo: 'boolean' },
      { key: 'cerrada',     label: 'Cerrada',       tipo: 'boolean' },
    ],
  },

  // ── Tarifas ──────────────────────────────────────────────────────────────
  {
    key: 'tarifas',
    title: 'Tarifas',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    description: 'Tarifas por tipo de camión, ruta y temporada.',
    idField: 'id_tarifa',
    softDeleteField: 'activo',
    permiso: 'tarifas',
    tipoEspecial: 'tarifas',
    columnas: [
      { key: 'temporada_codigo',   label: 'Temporada',  tipo: 'mono' },
      { key: 'nombre_ruta',        label: 'Ruta',       tipo: 'text' },
      { key: 'tipo_camion_nombre', label: 'Tipo Cam.',  tipo: 'text' },
      { key: 'monto_fijo',         label: 'Monto',      tipo: 'currency' },
      { key: 'moneda',             label: 'Moneda',     tipo: 'text' },
      { key: 'activo',             label: 'Activo',     tipo: 'bool' },
    ],
    camposCrear: [
      { key: 'id_tipo_camion', label: 'Tipo de Camión', tipo: 'select-entity', entity: 'tipos-camion', required: true,
        labelFields: ['nombre'], valueField: 'id_tipo_camion', nullLabel: 'Seleccionar...' },
      { key: 'id_temporada',   label: 'Temporada',      tipo: 'select-entity', entity: 'temporadas', required: true,
        labelFields: ['codigo', 'nombre'], valueField: 'id_temporada', nullLabel: 'Seleccionar...' },
      { key: 'id_ruta',        label: 'Ruta',           tipo: 'select-entity', entity: 'rutas', required: true,
        labelFields: ['nombre_ruta'], valueField: 'id_ruta', nullLabel: 'Seleccionar...' },
      { key: 'vigencia_desde', label: 'Vigencia Desde', tipo: 'date', required: true },
      { key: 'vigencia_hasta', label: 'Vigencia Hasta', tipo: 'date' },
      { key: 'prioridad',      label: 'Prioridad',      tipo: 'number', required: true, min: 1 },
      { key: 'regla',          label: 'Regla',          tipo: 'select-static', required: true,
        opciones: [
          { value: 'FIJO_POR_VIAJE',   label: 'Fijo por viaje' },
          { value: 'VARIABLE_POR_KM',  label: 'Variable por km' },
          { value: 'FIJO_POR_DIA',     label: 'Fijo por día' },
        ]
      },
      { key: 'moneda',         label: 'Moneda',         tipo: 'select-static', required: true,
        opciones: [
          { value: 'CLP', label: 'CLP — Peso chileno' },
          { value: 'USD', label: 'USD — Dólar' },
        ]
      },
      { key: 'monto_fijo',     label: 'Monto Fijo',     tipo: 'number', required: true, min: 0 },
    ],
  },

  // ── Centros de Costo ─────────────────────────────────────────────────────
  {
    key: 'centros-costo',
    title: 'Centros de Costo',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    description: 'Centros contables para clasificación de fletes.',
    idField: 'id_centro_costo',
    softDeleteField: 'activo',
    permiso: 'centros-costo',
    columnas: [
      { key: 'sap_codigo', label: 'Cód. SAP', tipo: 'mono' },
      { key: 'nombre',     label: 'Nombre',   tipo: 'text' },
      { key: 'activo',     label: 'Activo',   tipo: 'bool' },
    ],
    camposCrear: [
      { key: 'sap_codigo', label: 'Código SAP', tipo: 'text', required: true, placeholder: 'Código en SAP' },
      { key: 'nombre',     label: 'Nombre',     tipo: 'text', required: true, placeholder: 'Nombre del centro' },
    ],
  },

  // ── Cuentas Mayor ────────────────────────────────────────────────────────
  {
    key: 'cuentas-mayor',
    title: 'Cuentas Mayor',
    icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    description: 'Cuentas contables del libro mayor.',
    idField: 'id_cuenta_mayor',
    permiso: 'cuentas-mayor',
    columnas: [
      { key: 'codigo', label: 'Código', tipo: 'mono' },
      { key: 'glosa',  label: 'Glosa',  tipo: 'text' },
    ],
    camposCrear: [
      { key: 'codigo', label: 'Código', tipo: 'text', required: true, placeholder: 'Código contable' },
      { key: 'glosa',  label: 'Glosa',  tipo: 'text', required: true, placeholder: 'Descripción de la cuenta' },
    ],
  },

  // ── Usuarios ─────────────────────────────────────────────────────────────
  {
    key: 'usuarios',
    title: 'Usuarios',
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    description: 'Usuarios del sistema con roles y permisos.',
    idField: 'id_usuario',
    softDeleteField: 'activo',
    permiso: 'usuarios',
    tipoEspecial: 'usuarios',
    columnas: [
      { key: 'username', label: 'Usuario',  tipo: 'mono' },
      { key: 'email',    label: 'Email',    tipo: 'text' },
      { key: 'nombre',   label: 'Nombre',   tipo: 'text' },
      { key: 'apellido', label: 'Apellido', tipo: 'text' },
      { key: 'activo',   label: 'Activo',   tipo: 'bool' },
    ],
    camposCrear: [
      { key: 'username',  label: 'Nombre de usuario', tipo: 'text',     required: true, placeholder: 'usuario.apellido' },
      { key: 'email',     label: 'Correo electrónico', tipo: 'email',   required: true, placeholder: 'usuario@empresa.cl' },
      { key: 'nombre',    label: 'Nombre',             tipo: 'text',    placeholder: 'Nombre(s)' },
      { key: 'apellido',  label: 'Apellido',           tipo: 'text',    placeholder: 'Apellido(s)' },
      { key: 'password',  label: 'Contraseña',         tipo: 'password', required: true, placeholder: 'Mínimo 8 caracteres' },
      { key: 'id_rol',    label: 'Rol',               tipo: 'select-entity', entity: 'roles', required: true,
        labelFields: ['nombre'], valueField: 'id_rol', nullLabel: 'Seleccionar rol...' },
    ],
    camposEditar: [
      { key: 'username',  label: 'Nombre de usuario', tipo: 'text',     required: true, placeholder: 'usuario.apellido' },
      { key: 'email',     label: 'Correo electrónico', tipo: 'email',   required: true, placeholder: 'usuario@empresa.cl' },
      { key: 'nombre',    label: 'Nombre',             tipo: 'text',    placeholder: 'Nombre(s)' },
      { key: 'apellido',  label: 'Apellido',           tipo: 'text',    placeholder: 'Apellido(s)' },
      { key: 'password',  label: 'Nueva contraseña (opcional)', tipo: 'password', placeholder: 'Dejar vacío para no cambiar' },
      { key: 'id_rol',    label: 'Rol',               tipo: 'select-entity', entity: 'roles',
        labelFields: ['nombre'], valueField: 'id_rol', nullLabel: 'Sin cambiar rol...' },
    ],
  },

  // ── Nodos Logísticos ─────────────────────────────────────────────────────
  {
    key: 'nodos',
    title: 'Nodos Logísticos',
    icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
    description: 'Puntos de origen y destino en la red logística.',
    idField: 'id_nodo',
    softDeleteField: 'activo',
    permiso: 'nodos',
    columnas: [
      { key: 'nombre', label: 'Nombre',  tipo: 'text' },
      { key: 'region', label: 'Región',  tipo: 'text' },
      { key: 'ciudad', label: 'Ciudad',  tipo: 'text' },
      { key: 'activo', label: 'Activo',  tipo: 'bool' },
    ],
    camposCrear: [
      { key: 'nombre', label: 'Nombre',  tipo: 'text', required: true, placeholder: 'Nombre del nodo' },
      { key: 'region', label: 'Región',  tipo: 'text', required: true, placeholder: 'Ej: Metropolitana' },
      { key: 'comuna', label: 'Comuna',  tipo: 'text', required: true, placeholder: 'Ej: Santiago' },
      { key: 'ciudad', label: 'Ciudad',  tipo: 'text', required: true, placeholder: 'Ej: Santiago' },
      { key: 'calle',  label: 'Dirección', tipo: 'text', required: true, placeholder: 'Calle y número' },
    ],
  },
];

// ─── Mapa de acceso rápido ───────────────────────────────────────────────────
export const MANTENEDORES_MAP = new Map<string, MantenedorConfig>(
  MANTENEDORES_CONFIG.map(c => [c.key, c])
);
