# Feature Specification: Gestión de Resguardos por Estación

**Feature Branch**: `feature/resguardos-management`
**Created**: 2026-06-17
**Status**: Draft
**Input**: User description: "En hydro-api agregar Resguardos: una tab más en el panel de Hidrología, con filtros por estación y fecha, que traiga el resguardo de esa fecha con posibilidad de editar. La entidad tiene campos Originales (solo ver) y campos de Edición (modificables); el valor que aplica es el editado y, si está vacío, el original."

## Overview

Un operador del backoffice necesita revisar y corregir los **resguardos** (volumen de resguardo, cota de resguardo y volumen mínimo) que se cargan masivamente por importación para cada estación tipo embalse. Los datos importados son **inmutables** (valores originales) y deben poder consultarse siempre; las correcciones se aplican sobre un conjunto **editable** paralelo, de modo que el valor vigente sea el editado y, cuando no exista corrección, el original. Esta feature habilita **consultar** y **editar** resguardos por estación y fecha, preservando la trazabilidad entre el dato original y la corrección manual.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar resguardos de una estación (Priority: P1)

Como operador del backoffice, quiero seleccionar una estación y ver la serie de resguardos por fecha, para revisar los valores vigentes de cada día.

**Why this priority**: Sin la consulta no hay nada que revisar ni corregir. Es la base de la feature y entrega valor por sí sola (auditoría de los datos importados).

**Independent Test**: Con una estación que tiene resguardos importados, seleccionar la estación y verificar que se listan los resguardos por fecha mostrando el valor vigente (editado si existe, original si no) de volumen de resguardo, cota de resguardo y volumen mínimo.

**Acceptance Scenarios**:

1. **Given** una estación con resguardos importados, **When** el operador selecciona esa estación, **Then** se muestra la serie de resguardos por fecha con los valores vigentes (resueltos) de cada campo.
2. **Given** una estación con resguardos en distintas fechas, **When** el operador aplica un filtro de rango de fechas (desde/hasta), **Then** solo se muestran los resguardos cuyas fechas caen dentro del rango.
3. **Given** que no se ha seleccionado ninguna estación, **When** el operador abre la consulta, **Then** no se listan resguardos y se indica que debe seleccionar una estación.
4. **Given** una estación sin resguardos cargados, **When** el operador la selecciona, **Then** se muestra un estado vacío indicando que no hay resguardos.
5. **Given** un resguardo cuyo campo editable está vacío, **When** se muestra en la serie, **Then** el valor vigente para ese campo es el original.

---

### User Story 2 - Editar el resguardo de una fecha (Priority: P1)

Como operador del backoffice, quiero editar el resguardo de una fecha puntual viendo a la vez el valor original (solo lectura) y el editable, para corregir el dato sin perder la referencia del importado.

**Why this priority**: Es el objetivo central de la feature: corregir resguardos manteniendo la trazabilidad con el original. Depende de poder consultar (US-01) pero es la razón de ser del trabajo.

**Independent Test**: Sobre un resguardo existente, abrir su edición, comprobar que los tres campos originales se muestran como solo lectura y los tres editables como modificables; modificar un editable, guardar, y verificar que el valor vigente pasa a ser el editado; vaciar un editable, guardar, y verificar que el valor vigente vuelve a ser el original.

**Acceptance Scenarios**:

1. **Given** un resguardo de una estación y fecha, **When** el operador abre su edición, **Then** ve los valores originales (volumen de resguardo, cota de resguardo, volumen mínimo) como **solo lectura** y los valores editables como campos **modificables**.
2. **Given** la edición abierta, **When** el operador modifica un campo editable y guarda, **Then** el valor vigente de ese campo pasa a ser el valor editado.
3. **Given** un campo editable con valor, **When** el operador lo vacía y guarda, **Then** el valor vigente de ese campo vuelve a ser el valor original (fallback).
4. **Given** la edición abierta, **When** el operador intenta modificar un campo original, **Then** el sistema no lo permite (campo solo lectura).
5. **Given** la edición de un resguardo, **When** la operación se guarda con éxito, **Then** la consulta de la serie refleja inmediatamente el valor vigente actualizado.
6. **Given** una estación y fecha sin resguardo, **When** se solicita su edición, **Then** el sistema responde que el resguardo no existe (no se crea uno nuevo).

---

### User Story 3 - Acceso integrado en el panel de Hidrología (Priority: P2)

Como operador del backoffice, quiero acceder a los resguardos desde una pestaña dentro del panel de Hidrología, junto a Cuencas, Subcuencas y Estaciones, para trabajar en un único lugar consistente con el resto de la gestión hidrológica.

**Why this priority**: Aporta usabilidad y coherencia, pero la capacidad de consultar/editar (US-01, US-02) entrega valor aunque la ubicación final se ajuste.

**Independent Test**: Abrir el panel de Hidrología y verificar que existe una pestaña "Resguardos" con el mismo lenguaje visual y patrón de interacción que la pestaña Estaciones (encabezado con conteo, búsqueda, filtros y acción de edición).

**Acceptance Scenarios**:

1. **Given** el panel de Hidrología, **When** el operador lo abre, **Then** ve una pestaña "Resguardos" junto a Cuencas, Subcuencas y Estaciones.
2. **Given** la pestaña Resguardos, **When** el operador la usa, **Then** la única acción disponible sobre cada resguardo es **Editar** (no hay crear, ni activar/desactivar, ni eliminar).
3. **Given** la pestaña Resguardos, **When** se compara con la pestaña Estaciones, **Then** comparte el lenguaje visual (encabezado con conteo, búsqueda, filtros, modal de edición).

---

### Edge Cases

- **Rango de fechas inválido** (desde posterior a hasta): el sistema no debe romper; debe devolver un resultado vacío o un error de validación claro.
- **Estación inexistente**: consultar resguardos de un código de estación que no existe debe responder "estación no encontrada".
- **Fecha sin resguardo**: editar una fecha sin resguardo no crea uno; informa que no existe.
- **Todos los campos editables vacíos**: el resguardo sigue siendo válido y los valores vigentes son todos los originales.
- **Estación con muchos resguardos** (p. ej. un año completo): la consulta por estación debe seguir siendo utilizable (filtrado por fecha disponible para acotar).
- **Valor editable igual al original**: se permite; el valor vigente es el editado (aunque coincida).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir consultar los resguardos de una estación identificada por su código, devolviendo los resguardos por fecha con el **valor vigente** de cada campo (volumen de resguardo, cota de resguardo, volumen mínimo).
- **FR-002**: El **valor vigente** de cada campo MUST calcularse como el valor editado si existe, y el valor original en caso contrario.
- **FR-003**: La consulta por estación MUST aceptar un filtro **opcional** por rango de fechas (desde/hasta) y, cuando se provee, MUST devolver únicamente los resguardos dentro del rango.
- **FR-004**: La selección de estación MUST ser **obligatoria** para listar resguardos; sin estación seleccionada no se devuelve serie alguna.
- **FR-005**: El sistema MUST permitir consultar el resguardo de una estación en una **fecha puntual**, devolviendo de forma **separada**: (a) los valores **originales** (solo lectura), (b) los valores **editados** (que pueden estar vacíos) y (c) los valores **vigentes** (resueltos). *(Cambio de contrato respecto del comportamiento actual, que solo devuelve los vigentes.)*
- **FR-006**: El sistema MUST permitir editar, para una estación y fecha, los tres campos editables (volumen de resguardo, cota de resguardo, volumen mínimo), aceptando valores numéricos o vacío (null) en cada uno.
- **FR-007**: El sistema MUST tratar los valores **originales** como **inmutables**: ninguna operación de esta feature puede modificarlos.
- **FR-008**: Cuando un campo editable se guarda como vacío (null), el sistema MUST aplicar el valor original como valor vigente de ese campo.
- **FR-009**: La edición MUST operar solo sobre resguardos **existentes**; si no existe resguardo para la estación y fecha indicadas, el sistema MUST responder "no encontrado" y NO crear uno nuevo.
- **FR-010**: Tras una edición exitosa, las consultas posteriores MUST reflejar el valor vigente actualizado de forma inmediata (sin datos obsoletos servidos desde caché).
- **FR-011**: El backoffice MUST exponer la gestión de resguardos como una pestaña dentro del panel de Hidrología, consistente con el patrón visual y de interacción de la pestaña Estaciones.
- **FR-012**: La gestión de resguardos en el backoffice MUST ofrecer **únicamente** la acción de **editar** por resguardo; NO debe ofrecer crear, eliminar ni activar/desactivar.
- **FR-013**: El alta de resguardos MUST permanecer exclusivamente por el mecanismo de importación existente; esta feature NO incorpora creación manual.

### Key Entities *(include if feature involves data)*

- **Resguardo de Estación**: registro asociado a una estación y a una fecha que representa los límites de resguardo de un embalse. Atributos:
  - Identidad: estación + fecha (única por combinación).
  - Valores **originales** (inmutables, provenientes de importación): volumen de resguardo, cota de resguardo, volumen mínimo.
  - Valores **editados** (correcciones manuales, opcionales/nullables): volumen de resguardo, cota de resguardo, volumen mínimo.
  - Atributo de procedencia: organismo.
  - El **valor vigente** de cada campo es un concepto derivado: editado si existe, original si no.
- **Estación**: entidad ya existente; el resguardo se consulta por el **código** de la estación. Una estación puede tener muchos resguardos (uno por fecha).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un operador puede, partiendo del panel de Hidrología, llegar a la serie de resguardos de una estación seleccionada en **3 interacciones o menos** (abrir pestaña, elegir estación, ver lista).
- **SC-002**: El 100% de los resguardos consultados muestran el valor vigente correcto según la regla "editado si existe, original si no" (verificable con casos donde el editable está presente y donde está vacío).
- **SC-003**: Al editar un campo editable y guardar, el valor vigente actualizado es visible en la consulta en menos de **2 segundos**, sin requerir recarga manual de datos cacheados.
- **SC-004**: En la edición, los 3 valores originales son siempre visibles y nunca modificables; ninguna acción del operador altera un valor original (0 casos de mutación de originales).
- **SC-005**: Vaciar un campo editado y guardar restablece el valor vigente al original en el **100%** de los casos.

## Assumptions

- La entidad de resguardo, el mecanismo de importación, la consulta por estación, la consulta por fecha y la edición ya existen en el servicio; el único cambio de backend requerido es **extender la respuesta de la consulta por fecha** para exponer originales, editados y vigentes por separado.
- El filtro de fecha en la consulta se interpreta como **rango opcional** (desde/hasta). Un único día se expresa como un rango de un día.
- La estación se referencia por su **código** (no por identificador interno) en las consultas de resguardos, consistente con el comportamiento actual.
- El backoffice destino es el panel administrativo existente que ya contiene las pestañas Cuencas/Subcuencas/Estaciones.
- No se requiere internacionalización adicional: la UI de copy va en español, el código y los identificadores en inglés (convención del proyecto).

## Out of Scope

- Creación manual de resguardos (el alta sigue siendo exclusivamente por importación).
- Eliminación de resguardos.
- Estado activo/inactivo (toggle) sobre resguardos: el resguardo no tiene ese concepto.
- Edición masiva de múltiples fechas en una sola operación.
- Historial/auditoría de quién editó y cuándo (más allá de los timestamps de auditoría existentes).
- Cambios en el mecanismo o formato de importación.
