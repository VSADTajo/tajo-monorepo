/**
 * Known meteorological providers in the SFTP storage tree.
 *
 * The worker discovers providers dynamically from the filesystem;
 * this enum is used purely for typing/known-values reference and is
 * NOT used as a hard whitelist. Folders not listed here are still
 * processed if they have a valid info.json.
 */
export enum MeteoProvider {
    RADAR = 'RADAR',
    HARMONIE = 'HARMONIE',
    EPS = 'EPS',
    SAIH = 'SAIH',
}
