import { AlertTemplate, ConditionOperator, DataSource, NotificationSeverity } from '../types/alert.types';

export const ALERT_TEMPLATES: AlertTemplate[] = [
    {
        id: 'no_simulations',
        name: 'Sin simulaciones',
        description: 'Alerta si no hay simulaciones nuevas en X horas',
        dataSource: DataSource.PG_PREDICTIONS,
        query: "SELECT COUNT(*) as count FROM simulations WHERE \"createdAt\" > NOW() - INTERVAL '{{hours}} hours'",
        condition: { operator: ConditionOperator.EQ, value: 0, field: 'count' },
        intervalMinutes: 10,
        notification: {
            severity: NotificationSeverity.CRITICAL,
            title: 'Sin simulaciones nuevas',
            message: 'No se han recibido simulaciones en las ultimas {{hours}} horas',
        },
        cooldownMinutes: 60,
        variables: [{ name: 'hours', label: 'Horas sin simulaciones', type: 'number', default: 2 }],
    },
    {
        id: 'station_no_data',
        name: 'Estacion sin datos',
        description: 'Alerta si no hay predicciones nuevas para una estacion en X horas',
        dataSource: DataSource.PG_PREDICTIONS,
        query: "SELECT COUNT(*) as count FROM predictions WHERE \"stationId\" = '{{stationId}}' AND \"createdAt\" > NOW() - INTERVAL '{{hours}} hours'",
        condition: { operator: ConditionOperator.EQ, value: 0, field: 'count' },
        intervalMinutes: 15,
        notification: {
            severity: NotificationSeverity.WARNING,
            title: 'Estacion sin datos: {{stationId}}',
            message: 'La estacion {{stationId}} no ha recibido predicciones en las ultimas {{hours}} horas',
        },
        cooldownMinutes: 60,
        variables: [
            { name: 'stationId', label: 'ID de la estacion (UUID)', type: 'string', default: '' },
            { name: 'hours', label: 'Horas sin datos', type: 'number', default: 1 },
        ],
    },
    {
        id: 'excessive_errors',
        name: 'Errores excesivos',
        description: 'Alerta si hay mas de N errores de un servicio en X minutos',
        dataSource: DataSource.MONGODB_LOCAL,
        query: '{"collection":"logs","filter":{"level":"error","source":"{{source}}","createdAt":{"$gte":"$NOW-{{minutes}}"}}}',
        condition: { operator: ConditionOperator.GT, value: 10, field: 'count' },
        intervalMinutes: 5,
        notification: {
            severity: NotificationSeverity.CRITICAL,
            title: 'Errores excesivos en {{source}}',
            message: 'Se detectaron mas de {{threshold}} errores en {{source}} en los ultimos {{minutes}} minutos',
        },
        cooldownMinutes: 30,
        variables: [
            { name: 'source', label: 'Servicio (ej: ms-predictions-api)', type: 'string', default: 'ms-predictions-api' },
            { name: 'minutes', label: 'Ventana en minutos', type: 'number', default: 30 },
            { name: 'threshold', label: 'Cantidad de errores para disparar', type: 'number', default: 10 },
        ],
    },
];
