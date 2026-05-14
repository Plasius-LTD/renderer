import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import { RenderStore } from "./renderStateProvider.js";

enum Perf {
  Low,
  Medium,
  High,
  Ultra,
}

export function AdaptiveDPR() {
  const { gl } = useThree();
  const dispatch = RenderStore.useDispatch();
  useEffect(() => {
    let lastTime = performance.now();
    let frames = 0;
    let currentPerf: Perf = Perf.Medium;
    let currentAnimationHandler = 0;

    const SAMPLE_WINDOW = 15;
    const frameHistory: number[] = [];

    const checkPerformance = () => {
      const now = performance.now();
      frames++;
      if (now - lastTime >= 1000) {
        dispatch({ type: "set_frame_rate", payload: frames });

        frameHistory.push(frames);
        if (frameHistory.length > SAMPLE_WINDOW) {
          frameHistory.shift();
        }

        const avgFPS =
          frameHistory.reduce((a, b) => a + b, 0) / frameHistory.length;

        if (avgFPS < 30 && currentPerf !== Perf.Low) {
          currentPerf = Perf.Low;
          dispatch({ type: "set_performance_tier", payload: "low" });
          gl.setPixelRatio(1);
        } else if (avgFPS >= 40 && avgFPS < 80 && currentPerf !== Perf.Medium) {
          currentPerf = Perf.Medium;
          dispatch({ type: "set_performance_tier", payload: "medium" });

          gl.setPixelRatio(2);
        } else if (avgFPS >= 70 && avgFPS < 120 && currentPerf !== Perf.High) {
          currentPerf = Perf.High;
          dispatch({ type: "set_performance_tier", payload: "high" });

          gl.setPixelRatio(3);
        } else if (avgFPS >= 120 && currentPerf !== Perf.Ultra) {
          currentPerf = Perf.Ultra;
          dispatch({ type: "set_performance_tier", payload: "ultra" });

          gl.setPixelRatio(4);
        }

        frames = 0;
        lastTime = now;
      }
      currentAnimationHandler = requestAnimationFrame(checkPerformance);
    };

    checkPerformance();
    return () => {
      cancelAnimationFrame(currentAnimationHandler);
      dispatch({ type: "set_frame_rate", payload: 0 });
    };
  }, [gl, dispatch]);

  return <Stats className="performanceContainer" />;
}
