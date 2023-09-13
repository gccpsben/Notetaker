function updatePos(pos: {'x':number, 'y':number}, el: HTMLElement)
{
    el.style.top = `${pos.y}px`;
    el.style.left = `${pos.x}px`;
}

export default
{
    created(el:HTMLElement, binding:any)
    { 
        updatePos(binding.value, el);
    },
    updated(el:HTMLElement, binding:any) 
    { 
        updatePos(binding.value, el);  
    }
}