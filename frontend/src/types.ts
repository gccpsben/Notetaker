export type FileObjectType = 
{
    objectName:string, 
    type: 'Folder'|'File'
};

export type APIListDirResponseType = FileObjectType[];

export type APIOpenNoteResponseType = 
{
    __v: number;
    _id: string;
    content: string;
    directory: string;
    name: string;
};