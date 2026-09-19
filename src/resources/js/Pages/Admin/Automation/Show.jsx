import AdminLayout from "@/Layouts/AdminLayout";
import { Head } from "@inertiajs/react";
import { useEffect, useMemo } from "react";
import axios from "axios";
import { route } from "ziggy-js";

const LABELS = {
    facturacion_total: "Facturación Total",
    utilidad_total: "Utilidad Total",
    utilidad_disponible: "Utilidad Disponible",
    egresos_total: "Egresos Totales",
    margen_global_pct: "Margen Global",
    ticket_promedio_global: "Ticket Promedio Global",
    dependencia_top3_pct: "Dependencia Top 3",
    crecimiento_mensual_pct: "Crecimiento Mensual",
    ingresos: "Ingresos",
    utilidad: "Utilidad",
    margen_promedio_pct: "Margen",
    ticket_promedio: "Ticket Promedio",
    nivel_riesgo: "Nivel de Riesgo",
    observacion: "Observación",
    observaciones: "Observaciones",
    modelos_mas_rentables: "Modelos Más Rentables",
    modelos_mayor_rotacion: "Modelos con Mayor Rotación",
    capacidad_mas_vendida: "Capacidad Más Vendida",
    color_mas_vendido: "Color Más Vendido",
    bateria_promedio_vendida: "Batería Promedio Vendida",
    configuracion_mas_rentable: "Configuración Más Rentable",
    procesador_mas_vendido: "Procesador Más Vendido",
    ram_mas_vendida: "RAM Más Vendida",
    almacenamiento_mas_vendido: "Almacenamiento Más Vendido",
    tipo_mas_vendido: "Tipo Más Vendido",
    producto_mayor_rotacion: "Producto con Mayor Rotación",
    producto_mejor_margen: "Producto con Mejor Margen",
    margen_promedio_accesorios: "Margen Promedio Accesorios",
    prioridad: "Prioridad",
    accion: "Acción",
    descripcion: "Descripción",
    impacto: "Impacto",
    impacto_estimado: "Impacto Estimado",
};

const PERCENT_KEYS = new Set([
    "margen_global_pct",
    "dependencia_top3_pct",
    "crecimiento_mensual_pct",
    "margen_promedio_pct",
    "margen_promedio_accesorios",
]);

const CURRENCY_KEYS = new Set([
    "facturacion_total",
    "utilidad_total",
    "utilidad_disponible",
    "egresos_total",
    "ticket_promedio_global",
    "ingresos",
    "utilidad",
    "ticket_promedio",
]);

export default function Show({ report }) {
    const parsed = useMemo(() => {
        try {
            return typeof report.content === "string"
                ? JSON.parse(report.content)
                : report.content;
        } catch {
            return null;
        }
    }, [report]);

    useEffect(() => {
        if (!report.viewed_at) {
            axios.post(route("admin.automation.markViewed", report.id)).catch(() => {});
        }
    }, [report.id, report.viewed_at]);

    if (!parsed) {
        return (
            <AdminLayout>
                <div className="p-10 text-red-500">Error procesando reporte.</div>
            </AdminLayout>
        );
    }

    const resumen = parsed?.resumen_ejecutivo ?? {};
    const crecimiento = resumen?.crecimiento_mensual_pct;

    return (
        <AdminLayout>
            <Head title="Inteligencia del negocio" />

            <div className="min-h-screen bg-gradient-to-br from-gris-50 via-sky-50 to-blue-100 p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-7xl space-y-8">
                    <header className="rounded-[2rem] bg-white/90 p-6 shadow-xl ring-1 ring-gris-200/70 sm:p-8">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-700">
                                    Inteligencia del negocio
                                </p>
                                <h1 className="mt-2 text-3xl font-bold tracking-tight text-gris-900 sm:text-4xl">
                                    Informe Estratégico Automatizado
                                </h1>
                                <p className="mt-3 max-w-3xl text-sm leading-6 text-gris-600 sm:text-base">
                                    Resumen ejecutivo consolidado para evaluar margen, concentración,
                                    crecimiento y decisiones comerciales con lectura rápida.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
                                <CompactStat
                                    label="Período"
                                    value={formatPeriod(parsed?.period_start, parsed?.period_end)}
                                />
                                <CompactStat
                                    label="Estado"
                                    value={report.viewed_at ? "Revisado" : "Nuevo"}
                                />
                            </div>
                        </div>
                    </header>

                    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <MetricCard title="Facturación Total" value={formatBs(resumen.facturacion_total)} color="indigo" />
                        <MetricCard title="Utilidad Total" value={formatBs(resumen.utilidad_total)} color="green" />
                        <MetricCard title="Utilidad Disponible" value={formatBs(resumen.utilidad_disponible)} color="emerald" />
                        <MetricCard title="Margen Global" value={formatPercent(resumen.margen_global_pct)} color="sky" />
                    </section>

                    <Section title="Crecimiento Mensual" subtitle="Comparación contra el período mensual anterior equivalente.">
                        <div
                            className={`rounded-3xl border p-6 sm:p-8 ${
                                crecimiento > 0
                                    ? "border-emerald-200 bg-emerald-50"
                                    : crecimiento < 0
                                      ? "border-rose-200 bg-rose-50"
                                      : "border-gris-200 bg-gris-50"
                            }`}
                        >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gris-600">Variación mensual</p>
                                    <div className="mt-1 text-3xl font-bold text-gris-900">
                                        {formatPercent(crecimiento)}
                                    </div>
                                </div>
                                <span
                                    className={`inline-flex w-fit rounded-full px-4 py-2 text-sm font-semibold ${
                                        crecimiento > 0
                                            ? "bg-emerald-100 text-emerald-700"
                                            : crecimiento < 0
                                              ? "bg-rose-100 text-rose-700"
                                              : "bg-gris-200 text-gris-700"
                                    }`}
                                >
                                    {crecimiento > 0 ? "Crecimiento" : crecimiento < 0 ? "Contracción" : "Estable"}
                                </span>
                            </div>
                        </div>
                    </Section>

                    <Section title="Análisis por Categoría" subtitle="Rentabilidad, margen y riesgo por línea de negocio.">
                        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                            {parsed?.analisis_por_categoria?.map((cat, i) => (
                                <article key={i} className="rounded-3xl border border-gris-200 bg-white p-6 shadow-sm">
                                    <div className="flex items-start justify-between gap-4">
                                        <h3 className="text-lg font-semibold capitalize text-gris-900">
                                            {humanize(cat.categoria)}
                                        </h3>
                                        <RiskBadge value={cat.nivel_riesgo} />
                                    </div>

                                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                                        <InfoPill label="Ingresos" value={formatBs(cat.ingresos)} />
                                        <InfoPill label="Utilidad" value={formatBs(cat.utilidad)} />
                                        <InfoPill label="Margen" value={formatPercent(cat.margen_promedio_pct)} />
                                        <InfoPill label="Ticket" value={formatBs(cat.ticket_promedio)} />
                                    </div>

                                    <p className="mt-5 text-sm leading-6 text-gris-600">
                                        {emptyText(cat.observacion)}
                                    </p>
                                </article>
                            ))}
                        </div>
                    </Section>

                    <div className="grid gap-8 xl:grid-cols-3">
                        <Section title="Análisis Celulares" subtitle="Modelos, capacidad, color y señales de mix comercial.">
                            <AnalysisBlock data={parsed?.analisis_celulares} />
                        </Section>

                        <Section title="Análisis Computadoras" subtitle="Configuraciones, ticket y oportunidad de upselling.">
                            <AnalysisBlock data={parsed?.analisis_computadoras} />
                        </Section>

                        <Section title="Análisis Accesorios" subtitle="Tipo, rotación y productos con mayor contribución.">
                            <AnalysisBlock data={parsed?.analisis_accesorios} />
                        </Section>
                    </div>

                    <div className="grid gap-8 xl:grid-cols-2">
                        <Section title="Riesgos Estratégicos" subtitle="Alertas de concentración, margen y dependencia comercial.">
                            <div className="space-y-4">
                                {parsed?.riesgos_estrategicos?.map((risk, i) => (
                                    <div key={i} className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
                                        <div className="text-sm font-semibold uppercase tracking-wide text-rose-700">
                                            {emptyText(risk.tipo)}
                                        </div>
                                        <p className="mt-2 text-sm leading-6 text-gris-700">
                                            {emptyText(risk.descripcion)}
                                        </p>
                                        <p className="mt-3 text-xs font-medium text-rose-700">
                                            {emptyText(risk.impacto)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </Section>

                        <Section title="Oportunidades" subtitle="Palancas de crecimiento y mejora de rentabilidad.">
                            <div className="space-y-4">
                                {parsed?.oportunidades?.map((opportunity, i) => (
                                    <div key={i} className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                                        <p className="text-sm leading-6 text-gris-700">
                                            {emptyText(opportunity.descripcion)}
                                        </p>
                                        <p className="mt-3 text-xs font-medium text-emerald-700">
                                            {emptyText(opportunity.impacto_estimado)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    </div>

                    <Section title="Recomendaciones Ejecutivas" subtitle="Acciones priorizadas para las siguientes decisiones de negocio.">
                        <div className="space-y-4">
                            {parsed?.recomendaciones_ejecutivas?.map((recommendation, i) => (
                                <div
                                    key={i}
                                    className="flex flex-col gap-4 rounded-3xl border border-gris-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between"
                                >
                                    <p className="text-sm leading-6 text-gris-700">
                                        {emptyText(recommendation.accion)}
                                    </p>
                                    <PriorityBadge value={recommendation.prioridad} />
                                </div>
                            ))}
                        </div>
                    </Section>
                </div>
            </div>
        </AdminLayout>
    );
}

function MetricCard({ title, value, color }) {
    const colors = {
        indigo: "bg-indigo-100 text-indigo-700",
        green: "bg-emerald-100 text-emerald-700",
        emerald: "bg-teal-100 text-teal-700",
        sky: "bg-sky-100 text-sky-700",
    };

    return (
        <div className="rounded-[2rem] bg-white p-6 shadow-lg ring-1 ring-gris-200/70">
            <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${colors[color]}`}>
                {title}
            </div>
            <div className="mt-4 text-2xl font-bold tracking-tight text-gris-900 sm:text-3xl">{value}</div>
        </div>
    );
}

function CompactStat({ label, value }) {
    return (
        <div className="rounded-2xl bg-gris-50 px-4 py-3 ring-1 ring-gris-200">
            <div className="text-xs font-semibold uppercase tracking-wide text-gris-500">{label}</div>
            <div className="mt-1 text-sm font-semibold text-gris-800">{value}</div>
        </div>
    );
}

function Section({ title, subtitle, children }) {
    return (
        <section className="rounded-[2rem] bg-white p-6 shadow-xl ring-1 ring-gris-200/70 sm:p-8">
            <div className="mb-6">
                <h2 className="text-2xl font-semibold tracking-tight text-gris-900">{title}</h2>
                {subtitle ? <p className="mt-2 text-sm leading-6 text-gris-600">{subtitle}</p> : null}
            </div>
            {children}
        </section>
    );
}

function AnalysisBlock({ data }) {
    if (!data || typeof data !== "object") {
        return <p className="text-sm text-gris-500">No hay información analítica disponible para esta sección.</p>;
    }

    const entries = Object.entries(data).filter(([, value]) => value !== undefined && value !== null);

    return (
        <div className="space-y-4">
            {entries.map(([key, value]) => (
                <div key={key} className="rounded-2xl bg-gris-50 p-4 ring-1 ring-gris-200">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gris-500">
                        {labelFor(key)}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-gris-700">
                        {renderValue(key, value)}
                    </div>
                </div>
            ))}
        </div>
    );
}

function renderValue(key, value) {
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return <span className="text-gris-400">Sin registro suficiente</span>;
        }

        if (typeof value[0] === "object" && value[0] !== null) {
            return (
                <div className="space-y-2">
                    {value.map((item, index) => (
                        <div key={`${key}-${index}`} className="rounded-xl bg-white p-3 ring-1 ring-gris-200">
                            <div className="font-medium text-gris-900">
                                {emptyText(item.valor || item.producto || item.nombre || item.categoria)}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gris-500">
                                {item.unidades !== undefined ? <span>Unidades: {item.unidades}</span> : null}
                                {item.ingresos !== undefined ? <span>Ingresos: {formatBs(item.ingresos)}</span> : null}
                                {item.utilidad !== undefined ? <span>Utilidad: {formatBs(item.utilidad)}</span> : null}
                                {item.margen_pct !== undefined ? <span>Margen: {formatPercent(item.margen_pct)}</span> : null}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        return value.join(", ");
    }

    if (typeof value === "object" && value !== null) {
        return (
            <div className="grid gap-2">
                {Object.entries(value).map(([childKey, childValue]) => (
                    <div key={childKey} className="flex flex-wrap gap-2">
                        <span className="font-medium text-gris-800">{labelFor(childKey)}:</span>
                        <span>{formatFieldValue(childKey, childValue)}</span>
                    </div>
                ))}
            </div>
        );
    }

    return formatFieldValue(key, value);
}

function formatFieldValue(key, value) {
    if (value === "" || value === null || value === undefined) {
        return <span className="text-gris-400">Sin registro suficiente</span>;
    }

    if (typeof value === "number") {
        if (CURRENCY_KEYS.has(key)) {
            return formatBs(value);
        }

        if (PERCENT_KEYS.has(key)) {
            return formatPercent(value);
        }
    }

    if (typeof value === "string" && value.trim().toUpperCase() === "N/A") {
        return <span className="text-gris-400">Sin registro suficiente</span>;
    }

    return value;
}

function InfoPill({ label, value }) {
    return (
        <div className="rounded-2xl bg-gris-50 p-3 ring-1 ring-gris-200">
            <div className="text-xs font-semibold uppercase tracking-wide text-gris-500">{label}</div>
            <div className="mt-1 text-sm font-semibold text-gris-800">{value}</div>
        </div>
    );
}

function RiskBadge({ value }) {
    const tones = {
        ALTO: "bg-rose-100 text-rose-700",
        MEDIO: "bg-amber-100 text-amber-700",
        BAJO: "bg-emerald-100 text-emerald-700",
    };

    return (
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tones[value] || "bg-gris-100 text-gris-700"}`}>
            {emptyText(value)}
        </span>
    );
}

function PriorityBadge({ value }) {
    const tones = {
        ALTA: "bg-rose-100 text-rose-700",
        MEDIA: "bg-amber-100 text-amber-700",
        BAJA: "bg-emerald-100 text-emerald-700",
    };

    return (
        <span className={`inline-flex w-fit rounded-full px-4 py-2 text-xs font-semibold ${tones[value] || "bg-gris-100 text-gris-700"}`}>
            {emptyText(value)}
        </span>
    );
}

function humanize(value) {
    return String(value || "")
        .replace(/_/g, " ")
        .trim();
}

function labelFor(key) {
    return LABELS[key] || humanize(key);
}

function emptyText(value) {
    if (value === null || value === undefined || value === "") {
        return "Sin registro suficiente";
    }

    if (typeof value === "string" && value.trim().toUpperCase() === "N/A") {
        return "Sin registro suficiente";
    }

    return value;
}

function formatBs(value) {
    return `Bs ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value) {
    return `${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
}

function formatPeriod(start, end) {
    if (!start && !end) {
        return "Histórico completo";
    }

    if (start && end) {
        return `${start} a ${end}`;
    }

    return start || end;
}
