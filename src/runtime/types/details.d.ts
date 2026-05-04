interface IActionDetails {
    name: string;
    uriKey: string;
    fields: Record<string, string[]>;
    meta: unknown[];
    standalone: boolean;
}

interface IInstructionDetails {
    name: string;
    uriKey: string;
    fields: Record<string, string[]>;
    meta: unknown[];
    standalone: boolean;
}

interface IRelationDetails<T extends Model> {
    resources: string[];
    relation: string;
    constraints: Record<string, boolean>;
    name: string;
}

type IRuleDetails = Record<"all" | "create" | "update", Record<string, boolean>>;

interface IDetailsResponse<T extends Model> {
    actions: IActionDetails[];
    instructions: IInstructionDetails[];
    scout_instructions: IInstructionDetails[];
    fields: string[];
    scout_fields: string[];
    limits: number[];
    scopes: string[];
    relations: IRelationDetails<T>[];
    rules: IRuleDetails;
}

export {
    IActionDetails,
    IInstructionDetails,
    IRelationDetails,
    IRuleDetails,
    IDetailsResponse
}