// Carrusel automático con swipe táctil
class Carousel {
    constructor() {
        this.wrapper = document.querySelector('.carousel-wrapper');
        this.slides = document.querySelectorAll('.carousel-slide');
        this.dots = document.querySelectorAll('.carousel-dot');
        this.currentIndex = 0;
        this.totalSlides = this.slides.length;
        this.autoplayInterval = null;
        this.touchStartX = 0;
        this.touchEndX = 0;
        
        this.init();
    }
    
    init() {
        // Autoplay cada 5 segundos
        this.startAutoplay();
        
        // Click en los dots
        this.dots.forEach(dot => {
            dot.addEventListener('click', (e) => {
                const index = parseInt(e.target.getAttribute('data-index'));
                this.goToSlide(index);
                this.resetAutoplay();
            });
        });
        
        // Touch events para swipe
        this.wrapper.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
        });
        
        this.wrapper.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
            this.resetAutoplay();
        });
        
        // Mouse events para desktop
        this.wrapper.addEventListener('mousedown', (e) => {
            this.touchStartX = e.screenX;
            this.wrapper.style.cursor = 'grabbing';
        });
        
        this.wrapper.addEventListener('mouseup', (e) => {
            this.touchEndX = e.screenX;
            this.handleSwipe();
            this.resetAutoplay();
            this.wrapper.style.cursor = 'grab';
        });
        
        // Pausar autoplay al hover (solo desktop)
        if (window.innerWidth >= 769) {
            this.wrapper.parentElement.addEventListener('mouseenter', () => {
                this.stopAutoplay();
            });
            
            this.wrapper.parentElement.addEventListener('mouseleave', () => {
                this.startAutoplay();
            });
        }
    }
    
    handleSwipe() {
        const swipeThreshold = 50;
        const diff = this.touchStartX - this.touchEndX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // Swipe left - siguiente
                this.nextSlide();
            } else {
                // Swipe right - anterior
                this.prevSlide();
            }
        }
    }
    
    goToSlide(index) {
        this.currentIndex = index;
        const offset = -100 * this.currentIndex;
        this.wrapper.style.transform = `translateX(${offset}%)`;
        this.updateDots();
    }
    
    nextSlide() {
        this.currentIndex = (this.currentIndex + 1) % this.totalSlides;
        this.goToSlide(this.currentIndex);
    }
    
    prevSlide() {
        this.currentIndex = (this.currentIndex - 1 + this.totalSlides) % this.totalSlides;
        this.goToSlide(this.currentIndex);
    }
    
    updateDots() {
        this.dots.forEach((dot, index) => {
            if (index === this.currentIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }
    
    startAutoplay() {
        this.autoplayInterval = setInterval(() => {
            this.nextSlide();
        }, 13000); // Cambia cada 13 segundos
    }
    
    stopAutoplay() {
        if (this.autoplayInterval) {
            clearInterval(this.autoplayInterval);
            this.autoplayInterval = null;
        }
    }
    
    resetAutoplay() {
        this.stopAutoplay();
        this.startAutoplay();
    }
}

// Inicializar el carrusel cuando cargue la página
document.addEventListener('DOMContentLoaded', () => {
    new Carousel();
});