import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';

import { GeoserverDbConfigModule } from '@config/geoserver/geoserver-config.module';
import { GeoserverDbConfigService } from '@config/geoserver/geoserver-config.service';
import { GeoPuntoSaih } from '@domain/entities/geo-punto-saih.entity';
import { GeoSubcuenca } from '@domain/entities/geo-subcuenca.entity';
import { MvChtUnificada } from '@domain/entities/mv-cht-unificada.entity';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            name: 'geoserver',
            imports: [GeoserverDbConfigModule],
            useFactory: async (configService: GeoserverDbConfigService) => ({
                ...configService.config,
                name: 'geoserver',
                entities: [GeoPuntoSaih, GeoSubcuenca, MvChtUnificada],
            }),
            inject: [GeoserverDbConfigService],
        } as TypeOrmModuleAsyncOptions),
        TypeOrmModule.forFeature([GeoPuntoSaih, GeoSubcuenca, MvChtUnificada], 'geoserver'),
    ],
    exports: [TypeOrmModule],
})
export class GeoserverDatabaseProviderModule {}
