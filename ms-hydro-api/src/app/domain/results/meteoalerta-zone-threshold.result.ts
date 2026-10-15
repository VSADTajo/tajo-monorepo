export class MeteoalertaZoneThresholdResult {
    readonly zonaCode: string;
    readonly zonaNombre: string;
    readonly provincia: string | null;
    readonly ccaa: string | null;
    readonly umbral1Precip1h: number | null;
    readonly umbral2Precip1h: number | null;
    readonly umbral3Precip1h: number | null;
    readonly umbral1Precip12h: number | null;
    readonly umbral2Precip12h: number | null;
    readonly umbral3Precip12h: number | null;

    constructor(params: {
        zonaCode: string;
        zonaNombre: string;
        provincia: string | null;
        ccaa: string | null;
        umbral1Precip1h: number | null;
        umbral2Precip1h: number | null;
        umbral3Precip1h: number | null;
        umbral1Precip12h: number | null;
        umbral2Precip12h: number | null;
        umbral3Precip12h: number | null;
    }) {
        this.zonaCode = params.zonaCode;
        this.zonaNombre = params.zonaNombre;
        this.provincia = params.provincia;
        this.ccaa = params.ccaa;
        this.umbral1Precip1h = params.umbral1Precip1h;
        this.umbral2Precip1h = params.umbral2Precip1h;
        this.umbral3Precip1h = params.umbral3Precip1h;
        this.umbral1Precip12h = params.umbral1Precip12h;
        this.umbral2Precip12h = params.umbral2Precip12h;
        this.umbral3Precip12h = params.umbral3Precip12h;
    }
}
