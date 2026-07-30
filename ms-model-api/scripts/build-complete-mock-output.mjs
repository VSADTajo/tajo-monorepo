#!/usr/bin/env node
/**
 * Builds the reference output the MOCK source serves: a FEWS response with
 * everything a healthy run would carry.
 *
 * The recorded output we had been using is a degraded sample — FEWS sent the
 * inflow forecast filled with -999 for all but two reservoirs, and no EPS series
 * at all. Replaying it meant MOCK exercised a broken model, so it could never
 * answer the question a mock exists to answer: does the pipeline work when the
 * model behaves? Two of 228 predictions came out filled and the screen looked
 * broken for reasons that had nothing to do with our code.
 *
 * Values are derived from the run's own outflow rather than invented from
 * nothing: inflow tracks each reservoir's real `Q.salida.forecast` with a smooth
 * daily variation, so volumes evolve gently instead of draining to zero or
 * exploding. A balance computed from absurd inflow would send us debugging
 * fictional problems.
 *
 * The degraded original is NOT thrown away — it is the fixture that reproduces
 * what FEWS actually sends today, and the evidence behind what we are asking
 * Idrica to fix.
 *
 * Usage:
 *   node scripts/build-complete-mock-output.mjs <recorded.json> <out.json>
 */

import { readFileSync, writeFileSync } from 'node:fs';

/** FEWS names the MIKE11 web-manager series with this suffix; the poller strips it. */
const WEB_SUFFIX = '.web';

const OUTFLOW = 'Q.salida.forecast';
const INFLOW = 'I.mk11.forecast';

/**
 * EPS members, keyed by the percentile the calculator resolves them by.
 * Names come from ms-calculator-api/src/config/reservoir_parameters.json — the
 * calculator looks them up verbatim, so a typo here is a silently empty column.
 */
const EPS_MEMBERS = [
    { percentile: 10, parameterId: 'I.mk11.EPS10forecast', factor: 0.7 },
    { percentile: 25, parameterId: 'I.mk11.EPS25forecast', factor: 0.85 },
    { percentile: 50, parameterId: 'I.mk11.EPSforecast', factor: 1.0 },
    { percentile: 75, parameterId: 'I.mk11.EPS75forecast', factor: 1.2 },
    { percentile: 90, parameterId: 'I.mk11.EPS90forecast', factor: 1.45 },
];

/** Steps in a day at 15 minutes, used to give the synthesised inflow a daily shape. */
const STEPS_PER_DAY = 96;

function stripWeb(parameterId) {
    return parameterId.endsWith(WEB_SUFFIX) ? parameterId.slice(0, -WEB_SUFFIX.length) : parameterId;
}

function isMissing(value, missVal) {
    return value === missVal || value === '-999.0' || value === '-999';
}

/**
 * Inflow for one step: the outflow with a gentle surplus that varies over the
 * day. Missing outflow stays missing — inventing a value where the model had
 * none would make the mock less faithful, not more useful.
 */
function inflowFrom(outflowValue, index, missVal) {
    if (isMissing(outflowValue, missVal)) return missVal;

    const outflow = Number(outflowValue);
    if (!Number.isFinite(outflow)) return missVal;

    const daily = 1.12 + 0.22 * Math.sin((2 * Math.PI * index) / STEPS_PER_DAY);
    // Reservoirs with no outflow still receive water; a flat zero would make the
    // balance constant and hide any bug in it.
    const base = outflow > 0.05 ? outflow : 0.4;
    return (base * daily).toFixed(3);
}

function scaleSeries(events, factor, missVal) {
    return events.map((event) => {
        if (isMissing(event.value, missVal)) return { ...event };
        const scaled = Number(event.value) * factor;
        return { ...event, value: Number.isFinite(scaled) ? scaled.toFixed(3) : missVal };
    });
}

function main() {
    const [source, destination] = process.argv.slice(2);
    if (!source || !destination) {
        console.error('uso: node build-complete-mock-output.mjs <recorded.json> <out.json>');
        process.exit(1);
    }

    const document = JSON.parse(readFileSync(source, 'utf-8'));
    const series = document.timeSeries ?? [];

    const outflowByLocation = new Map();
    const inflowByLocation = new Map();

    for (const entry of series) {
        const header = entry.header ?? {};
        const parameterId = stripWeb(header.parameterId ?? '');
        if (parameterId === OUTFLOW) outflowByLocation.set(header.locationId, entry);
        if (parameterId === INFLOW) inflowByLocation.set(header.locationId, entry);
    }

    /** Series carried over untouched: everything that is not an inflow we rebuild. */
    const kept = series.filter((entry) => stripWeb(entry.header?.parameterId ?? '') !== INFLOW);
    const rebuilt = [];

    let filledInflow = 0;
    let keptInflow = 0;

    for (const [locationId, outflowSeries] of outflowByLocation) {
        const missVal = outflowSeries.header?.missVal ?? '-999.0';
        const existing = inflowByLocation.get(locationId);
        const existingEvents = existing?.events ?? [];
        const existingHasData = existingEvents.some((event) => !isMissing(event.value, missVal));

        // A real inflow series is always preferred: those two reservoirs are the
        // only place where we know what FEWS genuinely produces.
        const inflowEvents = existingHasData
            ? existingEvents
            : outflowSeries.events.map((event, index) => ({
                  ...event,
                  value: inflowFrom(event.value, index, missVal),
              }));

        if (existingHasData) keptInflow += 1;
        else filledInflow += 1;

        const baseHeader = existing?.header ?? {
            ...outflowSeries.header,
            parameterId: `${INFLOW}${WEB_SUFFIX}`,
        };

        rebuilt.push({
            ...(existing ?? {}),
            header: { ...baseHeader, parameterId: `${INFLOW}${WEB_SUFFIX}` },
            events: inflowEvents,
        });

        for (const member of EPS_MEMBERS) {
            rebuilt.push({
                header: { ...baseHeader, parameterId: `${member.parameterId}${WEB_SUFFIX}` },
                events: scaleSeries(inflowEvents, member.factor, missVal),
            });
        }
    }

    const output = { ...document, timeSeries: [...kept, ...rebuilt] };
    writeFileSync(destination, JSON.stringify(output, null, 1));

    const events = output.timeSeries.reduce((sum, entry) => sum + (entry.events?.length ?? 0), 0);
    console.log(`embalses con salida        : ${outflowByLocation.size}`);
    console.log(`entrada real conservada    : ${keptInflow}`);
    console.log(`entrada sintetizada        : ${filledInflow}`);
    console.log(`series EPS generadas       : ${outflowByLocation.size * EPS_MEMBERS.length}`);
    console.log(`series totales             : ${output.timeSeries.length}`);
    console.log(`eventos totales            : ${events}`);
}

main();
