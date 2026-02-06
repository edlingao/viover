export namespace adapters {
	
	export class ExportOptions {
	    format: string;
	    characterVolumes: Record<string, number>;
	    masterVolume: number;
	
	    static createFrom(source: any = {}) {
	        return new ExportOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.format = source["format"];
	        this.characterVolumes = source["characterVolumes"];
	        this.masterVolume = source["masterVolume"];
	    }
	}

}

export namespace core {
	
	export class Character {
	    id: string;
	    name: string;
	    color: string;
	
	    static createFrom(source: any = {}) {
	        return new Character(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.color = source["color"];
	    }
	}
	export class DeviceInfo {
	    devices_name: string;
	    id: string;
	
	    static createFrom(source: any = {}) {
	        return new DeviceInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.devices_name = source["devices_name"];
	        this.id = source["id"];
	    }
	}
	export class Recording {
	    id: string;
	    character_id: string;
	    file_path: string;
	    timecode: number;
	    duration: number;
	    volume: number;
	    gain_db: number;
	
	    static createFrom(source: any = {}) {
	        return new Recording(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.character_id = source["character_id"];
	        this.file_path = source["file_path"];
	        this.timecode = source["timecode"];
	        this.duration = source["duration"];
	        this.volume = source["volume"];
	        this.gain_db = source["gain_db"];
	    }
	}
	export class Video {
	    id: string;
	    file_name: string;
	    file_path: string;
	    thumbnail: string;
	
	    static createFrom(source: any = {}) {
	        return new Video(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.file_name = source["file_name"];
	        this.file_path = source["file_path"];
	        this.thumbnail = source["thumbnail"];
	    }
	}
	export class Project {
	    id: string;
	    title: string;
	    path: string;
	    video?: Video;
	    characters: Character[];
	    recordings: Recording[];
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.path = source["path"];
	        this.video = this.convertValues(source["video"], Video);
	        this.characters = this.convertValues(source["characters"], Character);
	        this.recordings = this.convertValues(source["recordings"], Recording);
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ProjectMeta {
	    id: string;
	    title: string;
	    path: string;
	    created_at?: string;
	    updated_at?: string;
	
	    static createFrom(source: any = {}) {
	        return new ProjectMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.path = source["path"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}
	

}

