const cast = {
  "string": value => value,
  "number": value => Number(value),
  "boolean": value => !!value,
  "object": value => JSON.parse(value),
}

export class CustomElement extends HTMLElement {

  protected name: string;
  protected markup: string;
  protected css: string;

  protected model: { [key: string]: any } = {};
  protected modelStructure: any;
  protected modelSetters: { [key: string]: Function } = {};

  protected modkeys: string[] = [];
  protected controls: { [key: string]: string } = {};
  protected actions: { [key: string]: (key: string) => void } = {};
  protected controlElementSelectors: string[] = [];
  protected keyspressed: string[] = [];

  constructor() { 
    super();
    this.attachShadow({ mode: "open" });
  }

  protected resetMarkup() {
    this.shadowRoot!.innerHTML = `<style>${this.css}</style>` + this.markup;
  }

  // MODEL FUNCTIONS

  protected useAttributes() {
    for (let attribute of this.attributes) {
      const modelProp = this.modelStructure.properties[attribute.name];
      if (!modelProp) continue;
      this.setModelValue(attribute.name, cast[modelProp.type](attribute.value));
    }
    const attributeObserver = new MutationObserver((mutationList) => {
      mutationList.forEach((mutation) => {
        const modelProp = this.modelStructure.properties[mutation.attributeName!];
        if (!modelProp) return;
        this.setModelValue(
          mutation.attributeName!, 
          cast[modelProp.type](this.getAttribute(mutation.attributeName!))
        );
      });
    });
    attributeObserver.observe(this, { attributes: true });
  }

  public setModel(value: object) : void {
    if (this.modelStructure.order) {
      for (const prop of this.modelStructure.order) {
        if (!value.hasOwnProperty(prop)) continue;
        this.setModelValue(prop, value[prop]);
      }
    }
    for (const prop in this.modelStructure.properties) {
      if (this.modelStructure.order?.includes(prop)) continue;
      if (!value.hasOwnProperty(prop)) continue;
      this.setModelValue(prop, value[prop]);
    }
  }

  public setModelValue(name: string, value: any) : void {
    this.validateProp(name, value);
    if (this.modelSetters[name]) {
      this.modelSetters[name](this.model[name], value);
    }
    this.model[name] = value;
    this.setAttribute(name, value);
  }

  private validateProp(name: string, value: any) : void {
    const propModel = this.modelStructure.properties[name];
    if (!propModel) {
      throw new Error(`[UI] -> {${this.name}} model prop {${name}} does not exist`);
    }
    const correctType = propModel.type == "array" ? Array.isArray(value) : typeof(value) == propModel.type;
    if (!correctType) {
      throw new Error(`[UI] -> {${this.name}} model prop {${name}} is type {${typeof(value)}}, but should be of type {${propModel.type}}`);
    }
  }

  public getModelValue(name: string) : any {
    if (this.model[name]) return this.model[name];
  }

  // SHADOW ROOT CONVENIENCE FUNCTIONS

  public element(selector: string) : any {
    return this.shadowRoot?.querySelector(selector);
  }

  public elements(selector: string) : NodeListOf<any> | undefined {
    return this.shadowRoot?.querySelectorAll(selector);
  }

  protected appendElement(element: any) : void {
    this.shadowRoot?.appendChild(element);
  }

  // CONTROLS

  protected keyup = (e: KeyboardEvent) => {
    if (this.modkeys.includes(e.key)) {
      this.keyspressed = this.keyspressed.filter(k => k != `mod-${e.key}`);
    } else {
      this.keyspressed = this.keyspressed.filter(k => k != e.key);
    }
  }

  protected keydown = (e: KeyboardEvent) : boolean => {

    if (this.keyspressed.length > 3) {
      this.keyspressed = [];
      return false;
    }

    if (this.modkeys.includes(e.key)) {
      this.keyspressed = [ `mod-${e.key}` ];
      return false;
    }

    this.keyspressed.push(e.key);

    if (this.keyevent(this.keyspressed.join(" "))) {
      this.keyspressed = this.keyspressed.filter(k => k.includes("mod"));
      return true;
    }

    if (this.keyspressed.length > 0) {
      const keys = this.keyspressed.join(" ");
      for (let child of this.controlElementSelectors) {
        if (this.element(child).keyevent(keys)) {
          this.keyspressed = this.keyspressed.filter(k => k.includes("mod"));
          return true;
        }
      }
    }

    return false;

    // should also reset keyspressed on leaving window
  }

  protected keyevent(keys: string) : boolean {

    const control = this.controls[keys];

    if (control) {
      this.actions[control](keys);
      return true;
    }

    return false;

  }

}