import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

/**
 * Cross-field validator: ensures this ISO 8601 date field is greater than or
 * equal to another date field on the same object. Passes when either value is
 * absent or not a well-formed date — format validation is left to @IsISO8601 so
 * this constraint only reports the ordering error.
 */
export function IsAfterOrEqual(property: string, validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string): void {
        registerDecorator({
            name: 'isAfterOrEqual',
            target: object.constructor,
            propertyName,
            constraints: [property],
            options: validationOptions,
            validator: {
                validate(value: unknown, args: ValidationArguments): boolean {
                    const [relatedPropertyName] = args.constraints as [string];
                    const relatedValue = (args.object as Record<string, unknown>)[relatedPropertyName];

                    if (typeof value !== 'string' || typeof relatedValue !== 'string') {
                        return true;
                    }

                    const current = new Date(value).getTime();
                    const related = new Date(relatedValue).getTime();

                    if (Number.isNaN(current) || Number.isNaN(related)) {
                        return true;
                    }

                    return current >= related;
                },
                defaultMessage(args: ValidationArguments): string {
                    const [relatedPropertyName] = args.constraints as [string];
                    return `${args.property} must be greater than or equal to ${relatedPropertyName}`;
                },
            },
        });
    };
}
