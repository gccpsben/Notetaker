import { getModelForClass, modelOptions, post, prop } from "@typegoose/typegoose";
import { dbMongoose } from "./databaseOperations";

@modelOptions ( { schemaOptions: { autoCreate: true , collection: "images" }, existingConnection:dbMongoose } )
export class ImageClass
{
    @prop({required:true})
    public imageName!: string;

    @prop({required:true})
    public imageBase64!: string;

    // @prop({required:true})
    // public imageBin!: BinaryData;

    public constructor(imageBase64:string, imageName:string) 
    {
        this.imageBase64 = imageBase64;
        this.imageName = imageName;
    }
}
export const ImageModel = getModelForClass(ImageClass);