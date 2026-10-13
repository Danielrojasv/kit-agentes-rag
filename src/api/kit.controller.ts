import { Body, Controller, Get, Post } from "@nestjs/common";

import { KitService } from "./kit.service";

class PeticionIngesta {
  rutas!: string[];
}

class PeticionConsulta {
  pregunta!: string;
  k?: number;
}

@Controller()
export class KitController {
  constructor(private readonly kit: KitService) {}

  @Get("salud")
  salud() {
    return this.kit.salud();
  }

  @Post("ingestar")
  ingestar(@Body() p: PeticionIngesta) {
    return this.kit.ingestar(p.rutas);
  }

  @Post("consultar")
  async consultar(@Body() p: PeticionConsulta) {
    const r = await this.kit.consultar(p.pregunta, p.k ?? 4);
    return { respuesta: r.texto, proveedor: r.proveedor, fuentes: r.fuentes };
  }
}
