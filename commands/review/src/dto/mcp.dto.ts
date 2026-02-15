import {
  ApiProperty,
  ApiPropertyOptional,
  IsString,
  IsBoolean,
  IsOptional,
  t,
} from "@spaceflow/core";

export class ListRulesInput {
  @ApiPropertyOptional({ description: t("review:mcp.dto.cwd") })
  @IsString()
  @IsOptional()
  cwd?: string;
}

export class GetRulesForFileInput {
  @ApiProperty({ description: t("review:mcp.dto.filePath") })
  @IsString()
  filePath!: string;

  @ApiPropertyOptional({ description: t("review:mcp.dto.cwd") })
  @IsString()
  @IsOptional()
  cwd?: string;

  @ApiPropertyOptional({ description: t("review:mcp.dto.includeExamples") })
  @IsBoolean()
  @IsOptional()
  includeExamples?: boolean;
}

export class GetRuleDetailInput {
  @ApiProperty({ description: t("review:mcp.dto.ruleId") })
  @IsString()
  ruleId!: string;

  @ApiPropertyOptional({ description: t("review:mcp.dto.cwd") })
  @IsString()
  @IsOptional()
  cwd?: string;
}
