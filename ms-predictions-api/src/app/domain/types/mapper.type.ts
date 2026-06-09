export abstract class Mapper<Dto, Command, Result, ResponseDto> {
    abstract toDto(command: Command): Dto;
    abstract toCommand(dto: Dto): Command;
    abstract fromResultToResponseDto(result: Result): ResponseDto;
}
