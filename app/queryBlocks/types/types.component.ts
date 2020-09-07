import {
  Component,
  OnChanges,
  SimpleChange,
  Input,
  Output,
  EventEmitter
} from "@angular/core";
declare var $: any;

function flatmap<T, U>(arr: T[], fn: (el: T) => U[]): U[] {
  let res = []
  arr.forEach(x => res.push(...fn.call(this, x)))
  return res;
}

function esTypeToJSType(type: string): string {
  switch (type) {
    case "long":
    case "integer":
    case "short":
    case "byte":
    case "double":
    case "float":
    case "date":
      return "numeric";
    case "text":
    case "keyword":
      return "string";
    default:
      return type
  }
}

@Component({
  selector: "types",
  templateUrl: "./app/queryBlocks/types/types.component.html",
  inputs: ["detectChange", "setProp", "buildQuery"]
})
export class TypesComponent implements OnChanges {
  @Input() mapping: any;
  @Input() config: any;
  @Input() types: any;
  @Input() selectedTypes: any;
  @Input() result: any;
  @Input() finalUrl: string;
  @Input() urlShare: any;
  @Input() version: number;
  @Output() setProp = new EventEmitter<any>();
  @Output() buildQuery = new EventEmitter<any>();

  constructor() {}

  ngOnInit() {
    var self = this;
    if (this.version >= 6) {
      setTimeout(function() {
        self.selectedTypes = ["_doc"];
        $("#setType")
          .val(self.selectedTypes)
          .trigger("change");
      });
    }
  }

  ngOnChanges(changes: { [propertyName: string]: SimpleChange }) {
    if (changes["detectChange"] && this.types.length) {
      var setType = $("#setType");
      if (setType.attr("class").indexOf("selec2") > -1) {
        setType.select2("destroy").html("");
      }
      setType.select2({
        placeholder: "Select types to apply query",
        tags: false,
        data: this.createTokenData(this.types)
      });
      setType.on(
        "change",
        function(e) {
          this.changeType(setType.val());
        }.bind(this)
      );
    }
  }

  createTokenData(types) {
    var data = [];
    types.forEach(function(val) {
      var obj = {
        id: val,
        text: val
      };
      data.push(obj);
    });
    return data;
  }

  changeType(val) {
    //this.mapping.resultQuery.result = [];
    var propInfo: any;
    var allMappings = this.mapping[this.config.appname].mappings;
    this.result.joiningQuery = [""];


    function flattenIndexMapping(mapObj: any, parentPath: string = ''): any[] {
      const { fields, properties, type } = mapObj;
      const fieldName = parentPath.replace(/\.$/, '')
      // TODO: We almost certainly do the wrong thing for nested things... what's the right thing?
      if (type === "nested" && this.result.joiningQuery.indexOf("nested") < 0) {
        this.result.joiningQuery.push("nested");
      }

      const objSeq = type == null ? [] : [{
        name: fieldName,
        type: esTypeToJSType(type),
        index: null
      }]
      const fieldsMapped: any[] = fields ? flatmap(Object.keys(fields), (x: string) =>
        flattenIndexMapping.call(this, fields[x], parentPath + x + '.')
      ) : []
      const propertiesMapped: any[] = properties ? flatmap(Object.keys(properties), (x: string) =>
        flattenIndexMapping.call(this, properties[x], parentPath + x + '.')
      ) : []
      return ([ ...objSeq, ...fieldsMapped, ...propertiesMapped ])
    }

    if (val && val.length) {
      this.setUrl(val);
      propInfo = {
        name: "selectedTypes",
        value: val
      };
      this.setProp.emit(propInfo);
    } else {
      propInfo = {
        name: "selectedTypes",
        value: []
      };
      this.setProp.emit(propInfo);
      this.setUrl([]);
    }

    const availableFields: any[] = val && val.length ?
        flatmap(val, (type: string) => flattenIndexMapping.call(this, allMappings[type])) :
        [];
    propInfo = {
      name: "availableFields",
      value: availableFields
    };
    this.setProp.emit(propInfo);

    for (let type in allMappings) {
      if (allMappings[type].hasOwnProperty("_parent")) {
        if (val && val.indexOf(allMappings[type]["_parent"].type) > -1) {
          if (this.result.joiningQuery.indexOf("has_child") < 0) {
            this.result.joiningQuery.push("has_child");
            this.result.joiningQuery.push("has_parent");
            this.result.joiningQuery.push("parent_id");
          }
        }
      }
    }
  }

  setUrl(val: any) {
    var selectedTypes = val;
    if (!this.finalUrl) {
      console.log("Finalurl is not present");
    } else {
      var finalUrl = this.finalUrl.split("/");
      var lastUrl = "";
      // TODO: This should most definitely not be hardcoded, but the reasoning is:
      //  - this used to expect http(s?):, , $index, ...
      //  - we want to expect http(s?):, , chr-ui, (elastic|gateway), $index, ...
      //  - SO: We just add 2 to all the indexes. And the `.slice` is new. I think it's a bug not to have that?
      finalUrl[5] = this.config.appname;
      if (finalUrl.length > 6) {
        finalUrl = finalUrl.slice(0,6)
        finalUrl[6] = selectedTypes.join(",");
        finalUrl[7] = "_search";
        lastUrl = finalUrl.join("/");
      } else {
        var typeJoin = "" + selectedTypes.join(",");
        if (selectedTypes.length) {
          typeJoin = "/" + selectedTypes.join(",");
        }
        lastUrl = this.finalUrl + typeJoin + "/_search";
      }
      var propInfo = {
        name: "finalUrl",
        value: lastUrl
      };
      this.setProp.emit(propInfo);
    }
    setTimeout(
      function() {
        this.buildQuery.emit(null);
      }.bind(this),
      300
    );
  }
}
