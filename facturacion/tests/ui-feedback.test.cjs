const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path"), assert = require("node:assert/strict");
let siguiente = 0; const timers = new Map(); const elementos = [];
class Elemento {
    constructor(tag) {this.tag = tag; this.children = []; this.dataset = {}; this.events = {}; this.attrs = {}; this.isConnected = true; this.classList = {add: () => {}}; elementos.push(this);}
    setAttribute(k,v) {this.attrs[k] = v;}
    append(...hijos) {this.children.push(...hijos); hijos.forEach(h => {h.parent = this;});}
    appendChild(hijo) {this.append(hijo);}
    get firstElementChild() {return this.children[0];}
    addEventListener(n,f) {this.events[n] = f;}
    remove() {this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(h => h !== this);}
    focus() {documento.activeElement = this;}
    showModal() {this.open = true;}
    close() {this.open = false; this.events.close?.();}
}
const disparador = new Elemento("button");
const documento = {body: new Elemento("body"), activeElement: disparador,
    createElement: tag => new Elemento(tag), querySelector: selector => elementos.find(e => e.isConnected && "#" + e.id === selector),
    querySelectorAll: () => [], addEventListener() {}};
const ctx = vm.createContext({document: documento, MutationObserver: class {observe() {}},
    setTimeout: f => {timers.set(++siguiente, f); return siguiente;}, clearTimeout: n => timers.delete(n)});
vm.runInContext(fs.readFileSync(path.join(__dirname,"../ui-feedback.js"),"utf8"),ctx);
const ejecutarTimers = () => {const tareas = [...timers.values()]; timers.clear(); tareas.forEach(f => f());};
const dialogo = () => documento.body.children.find(e => e.tag === "dialog");
(async () => {
    const cancelada = ctx.confirmarAccion("¿Eliminar <b>producto</b>?", {peligro:true});
    let d = dialogo(); assert.equal(d.dataset.peligro,"true"); assert.equal(d.children[2].textContent,"¿Eliminar <b>producto</b>?");
    assert.equal(documento.activeElement.textContent,"Cancelar");
    assert.equal(await ctx.confirmarAccion("Segundo"),false); assert.equal(documento.body.children.filter(e => e.tag === "dialog").length,1);
    d.events.cancel({preventDefault() {}}); ejecutarTimers(); assert.equal(await cancelada,false); assert.equal(documento.activeElement,disparador);
    const aceptada = ctx.confirmarAccion("¿Continuar?"); d = dialogo(); d.children[3].children[1].events.click();
    ejecutarTimers(); assert.equal(await aceptada,true); assert.equal(dialogo(),undefined);
    const detalle = ctx.confirmarAccion("Detalle", {soloLectura:true, aceptar:"Cerrar"});
    d = dialogo(); assert.equal(d.children[3].children[0].hidden,true); assert.equal(documento.activeElement.textContent,"Cerrar");
    d.events.cancel({preventDefault() {}}); ejecutarTimers(); await detalle;
    for(let i=0;i<4;i++) ctx.notificarUI("Mensaje " + i, i === 3 ? "error" : "success");
    const region = documento.querySelector("#avisosUI"); assert.equal(region.children.length,3);
    const aviso = region.children[2]; assert.equal(aviso.attrs.role,"alert");
    assert.equal(aviso.children[1].textContent,"Mensaje 3");
    aviso.children[2].events.click(); ejecutarTimers(); assert.equal(aviso.isConnected,false);
    console.log("PASS: diálogo único, cancelar/Escape, confirmar, foco, detalle, texto seguro y avisos cerrables.");
})().catch(e => {console.error(e); process.exitCode = 1;});
