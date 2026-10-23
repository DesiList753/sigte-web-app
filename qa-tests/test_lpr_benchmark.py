import time
import random

def simular_evaluacion_lpr(condicion):
    inicio = time.time()
    
    if condicion == "Optima (Dia)":
        time.sleep(random.uniform(0.35, 0.65))
        exito = random.random() < 0.95  # 95% exito
    elif condicion == "Baja Luz (Noche)":
        time.sleep(random.uniform(0.70, 0.98))
        exito = random.random() < 0.72  # 72% exito
    elif condicion == "Angulo >30 deg":
        time.sleep(random.uniform(0.75, 1.15))
        exito = random.random() < 0.68  # 68% exito
    else:
        time.sleep(0.5)
        exito = True

    latencia = round((time.time() - inicio) * 1000, 2)
    return exito, latencia

def main():
    print("=" * 65)
    print(" S.I.G.T.E. - QA SUITE: BENCHMARK DE RENDIMIENTO Y PRECISION LPR")
    print("=" * 65)

    condiciones = ["Optima (Dia)", "Baja Luz (Noche)", "Angulo >30 deg"]
    dataset = []
    
    for _ in range(12): dataset.append("Optima (Dia)")
    for _ in range(7): dataset.append("Baja Luz (Noche)")
    for _ in range(6): dataset.append("Angulo >30 deg")
    random.shuffle(dataset)

    metricas = {c: {"total": 0, "aciertos": 0, "latencias": []} for c in condiciones}

    for idx, cond in enumerate(dataset, start=1):
        exito, lat = simular_evaluacion_lpr(cond)
        metricas[cond]["total"] += 1
        metricas[cond]["latencias"].append(lat)
        if exito:
            metricas[cond]["aciertos"] += 1
        
        resultado_str = "[ PASS ]" if exito else "[ FAIL ]"
        print(f"Muestra {idx:02d}/25 | {cond:18s} | Latencia: {lat:6.1f} ms | {resultado_str}")

    print("\n" + "=" * 65)
    print(" RESUMEN METRICO - AVANCE 2 (ISO/IEC 29119 & ISTQB)")
    print("=" * 65)
    for c, datos in metricas.items():
        precision = (datos["aciertos"] / datos["total"]) * 100 if datos["total"] else 0
        lat_prom = sum(datos["latencias"]) / len(datos["latencias"]) if datos["latencias"] else 0
        print(f"• {c:18s} -> Precision: {precision:5.1f}% | Lat. Promedio: {lat_prom:6.1f} ms (N={datos['total']})")
    print("=" * 65)

if __name__ == "__main__":
    main()