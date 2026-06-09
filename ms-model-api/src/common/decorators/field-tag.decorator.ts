import 'reflect-metadata';

export const FIELD_TAG_METADATA_KEY = 'custom:fieldTag';

export function FieldTag(tag: string) {
    return (target: any, propertyKey: string) => {
        Reflect.defineMetadata(FIELD_TAG_METADATA_KEY, tag, target, propertyKey);
    };
}
