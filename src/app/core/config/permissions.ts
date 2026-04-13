/**
 * Constantes centralizadas de roles y permisos.
 * Fuente de verdad en frontend — los valores deben coincidir con la tabla cfl.Permiso.
 */

export const Roles = {
  ADMINISTRADOR: 'administrador',
  AUTORIZADOR: 'autorizador',
  INGRESADOR: 'ingresador',
} as const;

export type RoleName = (typeof Roles)[keyof typeof Roles];

export const ROLE_LABELS: Record<RoleName, string> = {
  [Roles.ADMINISTRADOR]: 'Administrador',
  [Roles.AUTORIZADOR]: 'Autorizador',
  [Roles.INGRESADOR]: 'Ingresador',
};

export const Perms = {
  // Fletes
  FLETES_CREAR: 'fletes.crear',
  FLETES_EDITAR: 'fletes.editar',
  FLETES_ANULAR: 'fletes.anular',
  FLETES_ESTADO_CAMBIAR: 'fletes.estado.cambiar',
  FLETES_CANDIDATOS_VIEW: 'fletes.candidatos.view',
  FLETES_SAP_DESCARTAR: 'fletes.sap.descartar',
  FLETES_SAP_ETL_EJECUTAR: 'fletes.sap.etl.ejecutar',
  FLETES_SAP_ETL_VER: 'fletes.sap.etl.ver',

  // Facturas
  FACTURAS_VER: 'facturas.ver',
  FACTURAS_EDITAR: 'facturas.editar',
  FACTURAS_CONCILIAR: 'facturas.conciliar',

  // Planillas
  PLANILLAS_VER: 'planillas.ver',
  PLANILLAS_GENERAR: 'planillas.generar',

  // Excepciones
  EXCEPCIONES_AUTORIZAR: 'excepciones.autorizar',
  EXCEPCIONES_GESTIONAR: 'excepciones.gestionar',

  // Mantenedores
  MANTENEDORES_ADMIN: 'mantenedores.admin',
  MANTENEDORES_VIEW: 'mantenedores.view',

  // Reportes
  REPORTES_VIEW: 'reportes.view',

  // Usuarios
  USUARIOS_PERMISOS_ADMIN: 'usuarios.permisos.admin',
} as const;
