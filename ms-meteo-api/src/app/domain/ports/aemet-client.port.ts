export interface AemetGeoJsonFeature {
    type: 'Feature';
    geometry: {
        type: 'Polygon' | 'Point';
        coordinates: number[][][] | number[];
    };
    properties: {
        identifier: string;
        sender: string;
        sent: string;
        status: string;
        msgType: string;
        language: string;
        category: string;
        event: string;
        responseType: string;
        urgency: string;
        severity: string;
        certainty: string;
        effective: string;
        onset: string;
        expires: string;
        senderName: string;
        headline: string;
        description: string;
        instruction: string;
        web: string;
        contact: string;
        eventCode: { valueName: string; value: string }[] | null;
        parameters: { valueName: string; value: string }[] | null;
        areaDesc: string;
        polygon: string;
        geocode: string;
        eventTypeCode: string;
        eventTypeName: string;
        provinciaCode: string;
        level: string;
    };
}

export interface AemetGeoJsonCollection {
    type: 'FeatureCollection';
    features: AemetGeoJsonFeature[];
}

export abstract class IAemetClient {
    abstract fetchAvisos(): Promise<AemetGeoJsonCollection>;
}
