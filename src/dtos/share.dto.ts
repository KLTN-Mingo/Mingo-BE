import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class SendDMShareDto {
  @IsMongoId()
  postId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsMongoId({ each: true })
  recipientIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export class RepostDto {
  @IsMongoId()
  postId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
