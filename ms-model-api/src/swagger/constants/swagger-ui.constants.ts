import { SwaggerUIConstants } from './swagger-ui-constants.interface';

export const SWAGGER_UI_CONSTANTS: SwaggerUIConstants = {
    TOPBAR: {
        BACKGROUND_COLOR: '#0C0C0D', // Dark background for topbar
    },
    AUTHORIZE: {
        BACKGROUND_COLOR: '#0066CC', // Bamboo blue for authorize button
    },
    HTTP_METHODS: {
        GET: {
            BACKGROUND_COLOR: '#D4EDDA', // Light green background for GET
            BORDER_COLOR: '#C3E6CB', // Darker green border
            SUMMARY_COLOR: '#155724', // Dark green text for readability
        },
        POST: {
            BACKGROUND_COLOR: '#CCE5FF', // Light blue background for POST
            BORDER_COLOR: '#B8DAFF', // Darker blue border
            SUMMARY_COLOR: '#004085', // Dark blue text
        },
        DELETE: {
            BACKGROUND_COLOR: '#F8D7DA', // Light red background for DELETE
            BORDER_COLOR: '#F5C6CB', // Darker red border
            SUMMARY_COLOR: '#721C24', // Dark red text
        },
        PATCH: {
            BACKGROUND_COLOR: '#FFF3CD', // Light yellow background for PATCH
            BORDER_COLOR: '#FFEEBA', // Darker yellow border
            SUMMARY_COLOR: '#856404', // Dark yellow text
        },
        PUT: {
            BACKGROUND_COLOR: '#FFF5CC', // Light orange background for PUT
            BORDER_COLOR: '#FFE8A1', // Darker orange border
            SUMMARY_COLOR: '#856404', // Dark orange text
        },
    },
};
