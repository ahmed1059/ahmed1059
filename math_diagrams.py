# -*- coding: utf-8 -*-
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import os

plt.rcParams['font.family'] = 'Tahoma'
plt.rcParams['axes.unicode_minus'] = False

def _ensure_dir(path):
    d = os.path.dirname(path)
    if d and not os.path.exists(d):
        os.makedirs(d)

def generate_coordinate_plane(p1, p2, path):
    _ensure_dir(path)
    fig, ax = plt.subplots(figsize=(5, 5), dpi=150)
    ax.set_xlim(-1, 10); ax.set_ylim(-1, 10)
    ax.grid(True, linestyle='--', alpha=0.6)
    ax.axhline(0, color='black', linewidth=1.5)
    ax.axvline(0, color='black', linewidth=1.5)
    ax.plot([p1[0], p2[0]], [p1[1], p2[1]], 'ro--', markersize=8)
    ax.annotate(f'أ({p1[0]}،{p1[1]})', xy=p1, xytext=(p1[0]+0.3, p1[1]+0.3), color='red', fontsize=12)
    ax.annotate(f'ب({p2[0]}،{p2[1]})', xy=p2, xytext=(p2[0]-1.5, p2[1]+0.3), color='blue', fontsize=12)
    ax.set_xticks(range(0, 11)); ax.set_yticks(range(0, 11))
    plt.savefig(path, bbox_inches='tight'); plt.close()

def generate_right_triangle(side_a, side_b, hyp, angle_label, path):
    _ensure_dir(path)
    fig, ax = plt.subplots(figsize=(5, 3), dpi=150)
    A, B, C = np.array([0, 0]), np.array([0, side_a]), np.array([side_b, 0])
    ax.add_patch(plt.Polygon([A, B, C], fill=None, edgecolor='navy', linewidth=2))
    ax.plot([0, 0.5, 0.5, 0], [side_a-0.5, side_a-0.5, side_a, side_a], color='navy', linewidth=1)
    ax.text(0.2, side_a/2, str(side_a), color='navy', fontsize=12)
    ax.text(side_b/2, -0.2, str(side_b), color='navy', fontsize=12, ha='center')
    ax.text(side_b/2, side_a/2 + 0.5, str(hyp), color='navy', fontsize=12, ha='center', rotation=-np.degrees(np.arctan(side_a/side_b)))
    ax.text(1, 0.5, f"∠{angle_label}", color='red', fontsize=14)
    ax.set_xlim(-1, side_b + 1); ax.set_ylim(-1, side_a + 1); ax.axis('off')
    plt.savefig(path, bbox_inches='tight'); plt.close()

def generate_parabola(a, b, c, path):
    _ensure_dir(path)
    fig, ax = plt.subplots(figsize=(5, 5), dpi=150)
    x = np.linspace(-4, 4, 400); y = a*x**2 + b*x + c
    ax.plot(x, y, color='navy', linewidth=2)
    ax.grid(True, linestyle='--', alpha=0.6)
    ax.axhline(0, color='black', linewidth=1.5); ax.axvline(0, color='black', linewidth=1.5)
    if a != 0:
        vx = -b / (2*a); vy = a*vx**2 + b*vx + c
        ax.plot(vx, vy, 'ro', markersize=8)
        ax.annotate('الرأس', xy=(vx, vy), xytext=(vx+0.5, vy+0.5), color='red', fontsize=12)
    plt.savefig(path, bbox_inches='tight'); plt.close()

def generate_number_line(lo, hi, path, empty=False):
    _ensure_dir(path)
    fig, ax = plt.subplots(figsize=(6, 1.5), dpi=150)
    ax.axhline(0, color='black', linewidth=1.5)
    for v in range(lo, hi+1):
        ax.plot(v, 0, 'k|', markersize=10)
        ax.text(v, -0.5, str(v), ha='center', va='top', fontsize=10)
    if empty: ax.text((lo+hi)/2, 0.5, "∅", color='red', fontsize=24, ha='center', va='center')
    ax.set_xlim(lo-1, hi+1); ax.set_ylim(-1, 1); ax.axis('off')
    plt.savefig(path, bbox_inches='tight'); plt.close()

def generate_lewis_nacl(path):
    _ensure_dir(path)
    fig, ax = plt.subplots(figsize=(4, 2), dpi=150)
    ax.text(0.2, 0.5, "Na", fontsize=20, fontweight='bold', va='center', ha='center')
    ax.text(0.2, 0.8, "+", fontsize=14, color='red', va='center', ha='center')
    ax.annotate("", xy=(0.6, 0.5), xytext=(0.4, 0.5), arrowprops=dict(arrowstyle="->"))
    ax.text(0.8, 0.5, "Cl", fontsize=20, fontweight='bold', va='center', ha='center')
    ax.text(0.8, 0.8, "-", fontsize=14, color='red', va='center', ha='center')
    for angle in range(0, 360, 45):
        rad = np.radians(angle); x = 0.8 + 0.15 * np.cos(rad); y = 0.5 + 0.15 * np.sin(rad)
        ax.plot(x, y, 'ro', markersize=4)
    ax.axis('off'); plt.savefig(path, bbox_inches='tight'); plt.close()

def generate_static_discharge(path):
    _ensure_dir(path)
    fig, ax = plt.subplots(figsize=(6, 3), dpi=150)
    ax.text(0.2, 0.5, "مقبض الباب", fontsize=12, ha='center')
    ax.text(0.2, 0.2, "(+)", fontsize=14, color='red', ha='center')
    ax.text(0.8, 0.5, "قدم على سجاد", fontsize=12, ha='center')
    ax.text(0.8, 0.2, "(-)", fontsize=14, color='blue', ha='center')
    ax.annotate("", xy=(0.6, 0.5), xytext=(0.4, 0.5), arrowprops=dict(arrowstyle="->", color="yellow", linewidth=2))
    ax.text(0.5, 0.6, "تفريغ", fontsize=10, color='orange', ha='center')
    ax.axis('off'); plt.savefig(path, bbox_inches='tight'); plt.close()

def generate_water_cycle(path):
    _ensure_dir(path)
    fig, ax = plt.subplots(figsize=(6, 4), dpi=150)
    ax.set_xlim(0, 10); ax.set_ylim(0, 6)
    ax.add_patch(plt.Rectangle((0, 0), 10, 1.5, color='#0ea5e9'))
    ax.text(5, 0.75, "البحر", color='white', fontsize=14, ha='center', va='center')
    ax.plot(2, 5, 'yo', markersize=20); ax.text(2, 4.5, "الشمس", ha='center')
    ax.plot([6, 7], [4.5, 4.5], 'o', color='gray', markersize=30, alpha=0.5); ax.text(6.5, 4.8, "سحاب", ha='center')
    ax.annotate("تبخر", xy=(3, 4.5), xytext=(3, 1.8), arrowprops=dict(arrowstyle="->", color="red", linewidth=2), ha='center', color='red')
    ax.annotate("هطول", xy=(6.5, 1.8), xytext=(6.5, 4.2), arrowprops=dict(arrowstyle="->", color="blue", linewidth=2), ha='center', color='blue')
    ax.axis('off'); plt.savefig(path, bbox_inches='tight'); plt.close()
